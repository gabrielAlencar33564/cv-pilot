import {
  JobRequirements,
  ParsedResume,
  type DismissJobInput,
  type JobListQuery,
  type Paginated,
  type RequirementsCheck,
} from '@cv-pilot/contracts';
import {
  dailyBucket,
  initialCoverLetter,
  requirementsCheck,
  resolveSendRule,
} from '@cv-pilot/core';
import { Prisma, comparisonResumeVersion, prisma } from '@cv-pilot/db';
import {
  enqueueApplication,
  enqueueCoverLetter,
  getRedis,
  releaseDailySlot,
  reserveDailySlot,
} from '@cv-pilot/queue';
import { HttpError } from '../../plugins/errors';

/** Vagas compatíveis com os perfis de busca do usuário, ordenadas pela nota. */
export async function listMatches(userId: string, q: JobListQuery) {
  const where = {
    dismissed: false,
    searchProfile: { userId, ...(q.searchProfileId ? { id: q.searchProfileId } : {}) },
    ...(q.minScore !== undefined ? { score: { gte: q.minScore } } : {}),
    job: { active: true },
  };
  const [total, matches] = await Promise.all([
    prisma.jobMatch.count({ where }),
    prisma.jobMatch.findMany({
      where,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        job: {
          omit: { requirements: true },
          include: { sources: { select: { sourceId: true, url: true } } },
        },
        searchProfile: { select: { id: true, name: true } },
      },
    }),
  ]);

  // a candidatura é por vaga (não por perfil): mostra o status em qualquer match da mesma vaga
  const applications = await prisma.application.findMany({
    where: { userId, jobId: { in: matches.map((m) => m.jobId) } },
    select: { id: true, jobId: true, status: true },
  });
  const byJob = new Map(applications.map((a) => [a.jobId, { id: a.id, status: a.status }]));

  const items = matches.map((m) => ({ ...m, application: byJob.get(m.jobId) ?? null }));
  const result: Paginated<(typeof items)[number]> = {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total,
  };
  return result;
}

async function findOwnedMatch(userId: string, matchId: string) {
  const match = await prisma.jobMatch.findFirst({
    where: { id: matchId, searchProfile: { userId } },
    include: {
      job: { include: { sources: { select: { sourceId: true, url: true } } } },
      searchProfile: {
        select: {
          id: true,
          name: true,
          sourceIds: true,
          dailyApplyLimit: true,
          companyBlacklist: true,
          user: { select: { timezone: true, name: true } },
        },
      },
    },
  });
  if (!match) throw new HttpError(404, 'job_match_not_found');
  return match;
}

type OwnedMatch = Awaited<ReturnType<typeof findOwnedMatch>>;

/**
 * O que seria enviado nesta vaga: a fonte (o site do perfil), a regra de envio que vale
 * (perfil+site → site → perfil → padrão) e a última versão do currículo dessa regra.
 * A pré-visualização (RF-24) e o "candidatar" usam o mesmo plano.
 */
async function applicationPlan(userId: string, match: OwnedMatch) {
  const jobSource =
    match.job.sources.find((s) => match.searchProfile.sourceIds.includes(s.sourceId)) ??
    match.job.sources[0];
  if (!jobSource) return { jobSource: null, rule: null, resumeVersion: null, letter: NO_LETTER };

  const rules = await prisma.sendRule.findMany({
    where: { userId },
    include: {
      resume: { select: { id: true, name: true } },
      coverLetterTemplate: { select: { body: true } },
    },
  });
  const rule =
    resolveSendRule(rules, {
      sourceId: jobSource.sourceId,
      searchProfileId: match.searchProfileId,
    }) ?? null;
  const resumeVersion = rule
    ? await prisma.resumeVersion.findFirst({
        where: { resumeId: rule.resumeId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, fileName: true, mimeType: true, parseStatus: true },
      })
    : null;
  const letter = rule
    ? initialCoverLetter(rule, {
        empresa: match.job.company,
        cargo: match.job.title,
        nome: match.searchProfile.user.name ?? '',
      })
    : NO_LETTER;
  return { jobSource, rule, resumeVersion, letter };
}

const NO_LETTER = { coverLetter: null, coverLetterStatus: null } as const;

/**
 * O que a vaga pede e o currículo não mostra (RF-41). Os requisitos foram extraídos uma vez
 * por vaga; a comparação com o currículo (o mesmo que o match usou) é feita aqui, sem IA.
 */
async function checkRequirements(
  userId: string,
  requirements: Prisma.JsonValue,
  resumeId: string | null,
): Promise<RequirementsCheck> {
  const extracted = JobRequirements.safeParse(requirements);
  if (!extracted.success) return { status: 'not_analyzed' };
  const version = await comparisonResumeVersion(userId, resumeId);
  const resume = ParsedResume.safeParse(version?.parsed);
  if (!resume.success) return { status: 'no_resume' };
  return { status: 'ready', ...requirementsCheck(extracted.data.requirements, resume.data) };
}

interface ApplicationLetter {
  coverLetter: string | null;
  coverLetterStatus: string | null;
}

/**
 * Carta escrita pela IA (ou sendo escrita) e carta editada pelo candidato pertencem à
 * candidatura. Só o modelo preenchido (status null) segue o modelo atual da regra.
 */
const keepsOwnLetter = (application: ApplicationLetter) => application.coverLetterStatus !== null;

/**
 * A carta que a pré-visualização mostra: a da candidatura quando ela é dona da carta ou já
 * saiu da sugestão; senão, a que a regra daria ao se candidatar.
 */
function previewLetter(
  application: (ApplicationLetter & { status: string }) | null,
  plan: ApplicationLetter,
) {
  if (application && (keepsOwnLetter(application) || application.status !== 'suggested')) {
    const { coverLetter, coverLetterStatus } = application;
    return { coverLetter, coverLetterStatus, coverLetterFromApplication: true };
  }
  return { ...plan, coverLetterFromApplication: false };
}

/** Detalhes da vaga (RF-41) e a pré-visualização do que vai ser enviado (RF-24). */
export async function getMatchDetail(userId: string, matchId: string) {
  const match = await findOwnedMatch(userId, matchId);
  const { jobSource, rule, resumeVersion, letter } = await applicationPlan(userId, match);
  const application = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId: match.jobId } },
    select: { id: true, status: true, coverLetter: true, coverLetterStatus: true },
  });
  const {
    searchProfile,
    job: { requirements, ...job },
    ...rest
  } = match;

  return {
    ...rest,
    job,
    searchProfile: { id: searchProfile.id, name: searchProfile.name },
    application: application && { id: application.id, status: application.status },
    requirements: await checkRequirements(userId, requirements, rule?.resume.id ?? null),
    preview: {
      sourceId: jobSource?.sourceId ?? null,
      rule: rule && {
        id: rule.id,
        mode: rule.mode,
        tone: rule.tone,
        reviewBeforeSend: rule.reviewBeforeSend,
        defaultAnswers: rule.defaultAnswers,
      },
      resume: rule && {
        id: rule.resume.id,
        name: rule.resume.name,
        version: resumeVersion,
      },
      ...previewLetter(application, letter),
    },
  };
}

/**
 * Candidatura manual: o usuário revisou e mandou enviar. Respeita o limite diário (RF-51)
 * e reaproveita a candidatura sugerida pelo match, se houver.
 */
export async function applyToMatch(userId: string, matchId: string) {
  const match = await findOwnedMatch(userId, matchId);
  const { jobSource, rule, resumeVersion, letter } = await applicationPlan(userId, match);
  if (!jobSource || !rule) throw new HttpError(409, 'send_rule_required');
  if (!resumeVersion) throw new HttpError(409, 'resume_file_required');

  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId: match.jobId } },
    select: { id: true, status: true, coverLetter: true, coverLetterStatus: true },
  });
  if (existing && existing.status !== 'suggested') throw new HttpError(409, 'already_applied');

  const slot = {
    userId,
    sourceId: jobSource.sourceId,
    day: dailyBucket(new Date(), match.searchProfile.user.timezone),
  };
  if (!(await reserveDailySlot(getRedis(), slot, match.searchProfile.dailyApplyLimit))) {
    throw new HttpError(409, 'daily_limit_reached');
  }

  let application;
  try {
    application = existing
      ? await prisma.application.update({
          where: { id: existing.id },
          // vai a carta que o candidato viu na pré-visualização, não a do momento do match
          data: { status: 'queued', ...(keepsOwnLetter(existing) ? {} : letter) },
          select: { id: true, status: true, coverLetterStatus: true },
        })
      : await prisma.application.create({
          data: {
            userId,
            jobId: match.jobId,
            sourceId: jobSource.sourceId,
            searchProfileId: match.searchProfileId,
            resumeVersionId: resumeVersion.id,
            sendRuleId: rule.id,
            mode: rule.mode,
            score: match.score,
            status: 'queued',
            ...letter,
            answers: rule.defaultAnswers ?? {},
          },
          select: { id: true, status: true, coverLetterStatus: true },
        });
  } catch (err) {
    await releaseDailySlot(getRedis(), slot);
    // o match criou a candidatura entre a checagem e o create
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'already_applied');
    }
    throw err;
  }
  // a IA escreve no worker, nunca na requisição; o job é idempotente pelo id da candidatura
  if (application.coverLetterStatus === 'generating') await enqueueCoverLetter(application.id);
  await enqueueApplication(application.id);
  return { id: application.id, status: application.status };
}

/** "Não tenho interesse" (RF-42): some da lista e, se pedido, a empresa entra na exclusão. */
export async function dismissMatch(userId: string, matchId: string, input: DismissJobInput) {
  const match = await findOwnedMatch(userId, matchId);
  const company = match.job.company;
  const alreadyBlocked = match.searchProfile.companyBlacklist.some(
    (c) => c.toLowerCase() === company.toLowerCase(),
  );

  await prisma.$transaction([
    prisma.jobMatch.update({
      where: { id: match.id },
      data: { dismissed: true, dismissedReason: input.reason },
    }),
    ...(input.blockCompany && !alreadyBlocked
      ? [
          prisma.searchProfile.update({
            where: { id: match.searchProfileId },
            data: { companyBlacklist: { push: company } },
          }),
        ]
      : []),
  ]);
}
