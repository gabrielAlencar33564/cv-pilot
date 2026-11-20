import { createHash } from 'node:crypto';
import {
  MANUAL_SOURCE_ID,
  type ExtensionSaveJobInput,
  type ExtensionSavedJob,
} from '@cv-pilot/contracts';
import { initialCoverLetter, jobDedupeHash, resolveSendRule } from '@cv-pilot/core';
import { Prisma, prisma } from '@cv-pilot/db';
import { enqueueCoverLetter } from '@cv-pilot/queue';
import { HttpError } from '../../plugins/errors';

/**
 * A fonte das vagas salvas pelo candidato existe sob demanda e fica inativa: nenhum bot busca
 * nela, e ela não aparece na escolha de sites.
 */
async function ensureManualSource() {
  await prisma.source.upsert({
    where: { id: MANUAL_SOURCE_ID },
    create: {
      id: MANUAL_SOURCE_ID,
      displayName: 'Salva por você',
      kind: 'manual',
      applyModes: ['assisted'],
      active: false,
    },
    update: {},
  });
}

/** A página da vaga identifica a vaga nesta fonte; o hash cabe no índice, a URL inteira não. */
const externalIdOf = (url: string) =>
  createHash('sha256')
    .update(url.split('#')[0] ?? url)
    .digest('hex');

/**
 * A vaga entra pelo mesmo dedupe das fontes: se ela já veio de um site, ganha só a fonte
 * manual. A página está aberta para o candidato, então a vaga volta a contar como aberta.
 */
async function upsertSavedJob(input: ExtensionSaveJobInput): Promise<string> {
  const dedupeHash = jobDedupeHash(input);
  const job = await prisma.job.upsert({
    where: { dedupeHash },
    create: {
      dedupeHash,
      title: input.title,
      company: input.company,
      location: input.location ?? null,
      description: input.description,
    },
    update: { active: true },
    select: { id: true },
  });
  await prisma.jobSource.upsert({
    where: {
      sourceId_externalId: { sourceId: MANUAL_SOURCE_ID, externalId: externalIdOf(input.url) },
    },
    create: {
      jobId: job.id,
      sourceId: MANUAL_SOURCE_ID,
      externalId: externalIdOf(input.url),
      url: input.url,
    },
    update: { lastSeen: new Date(), closedAt: null },
  });
  return job.id;
}

/**
 * "Salvar vaga de qualquer site" (ADR 0011): a vaga entra no funil já em "Ação necessária",
 * com o currículo, a carta e as respostas da regra de envio padrão, pronta para a extensão
 * preencher. Se o candidato já tinha candidatura para a vaga, devolve a que existe.
 */
export async function saveJobFromPage(
  userId: string,
  input: ExtensionSaveJobInput,
): Promise<ExtensionSavedJob> {
  await ensureManualSource();
  const jobId = await upsertSavedJob(input);

  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });
  if (existing) return { applicationId: existing.id, created: false };

  const rules = await prisma.sendRule.findMany({
    where: { userId },
    include: { coverLetterTemplate: { select: { body: true } } },
  });
  const rule = resolveSendRule(rules, { sourceId: MANUAL_SOURCE_ID });
  if (!rule) throw new HttpError(409, 'send_rule_required');
  const resumeVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId: rule.resumeId },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!resumeVersion) throw new HttpError(409, 'resume_file_required');
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  let application;
  try {
    application = await prisma.application.create({
      data: {
        userId,
        jobId,
        sourceId: MANUAL_SOURCE_ID,
        resumeVersionId: resumeVersion.id,
        sendRuleId: rule.id,
        mode: 'assisted',
        status: 'needs_action',
        ...initialCoverLetter(rule, {
          empresa: input.company,
          cargo: input.title,
          nome: user.name ?? '',
        }),
        answers: rule.defaultAnswers ?? {},
        log: [{ at: new Date().toISOString(), type: 'saved_from_page' }],
      },
      select: { id: true, coverLetterStatus: true },
    });
  } catch (err) {
    // salva duas vezes ao mesmo tempo (dois cliques): fica a primeira
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await prisma.application.findUniqueOrThrow({
        where: { userId_jobId: { userId, jobId } },
        select: { id: true },
      });
      return { applicationId: winner.id, created: false };
    }
    throw err;
  }
  // a IA escreve no worker, nunca na requisição
  if (application.coverLetterStatus === 'generating') await enqueueCoverLetter(application.id);
  return { applicationId: application.id, created: true };
}
