import type { JobRequirement, ParsedResume } from '@cv-pilot/contracts';
import { PrismaClient } from '@cv-pilot/db';
import { testDatabase } from '@cv-pilot/db/testing';
import { randomUUID } from 'node:crypto';

/** Acesso direto ao banco de teste, para montar cenários e simular o que os workers fazem. */
export const db = new PrismaClient({ datasourceUrl: testDatabase().url });

/** Fonte própria do E2E: nenhum worker busca nela (os workers nem sobem). */
export const E2E_SOURCE = {
  id: 'e2e-site',
  displayName: 'Site de teste E2E',
  kind: 'api',
  applyModes: ['assisted'],
};

/** Tudo o que o E2E cria fora da conta do usuário leva este prefixo, para a limpeza achar. */
const E2E_PREFIX = 'e2e-';
export const E2E_EMAIL_DOMAIN = '@teste-e2e.local';

const e2eId = (what: string) => `${E2E_PREFIX}${what}-${randomUUID()}`;

/** Currículo extraído de mentira, como o resume-parse gravaria. */
const PARSED_RESUME: ParsedResume = {
  summary: null,
  skills: ['React', 'TypeScript', 'Node.js'],
  experiences: [
    {
      company: 'Empresa Fictícia',
      role: 'Desenvolvedora Front-end Pleno',
      start: '2023-01',
      end: null,
      description: null,
    },
  ],
  education: [],
  languages: [],
};

/** Simula o `resume-parse`: a última versão enviada pelo usuário fica lida. */
export async function simulateResumeParsed(userId: string) {
  const version = await db.resumeVersion.findFirstOrThrow({
    where: { resume: { userId } },
    orderBy: { createdAt: 'desc' },
  });
  await db.resumeVersion.update({
    where: { id: version.id },
    data: { parsed: PARSED_RESUME, parseStatus: 'parsed', parsedAt: new Date() },
  });
}

/**
 * Cenário de vaga: perfil de busca, currículo com uma versão, regra de envio padrão com um
 * modelo de carta e uma vaga com nota alta para o perfil.
 */
export async function seedJobScenario(userId: string) {
  const resume = await db.resume.create({
    data: {
      userId,
      name: 'CV Técnico',
      versions: {
        create: {
          version: 1,
          // o arquivo não existe no S3: o cenário não abre o currículo, só o nome aparece
          storageKey: e2eId('arquivo'),
          fileName: 'cv-tecnico.pdf',
          mimeType: 'application/pdf',
          parseStatus: 'parsed',
          parsed: PARSED_RESUME,
        },
      },
    },
  });
  const template = await db.coverLetterTemplate.create({
    data: { userId, name: 'Padrão', body: 'Olá, {{empresa}}! Sou {{nome}} e quero ser {{cargo}}.' },
  });
  await db.sendRule.create({
    data: { userId, resumeId: resume.id, coverLetterTemplateId: template.id },
  });
  const profile = await db.searchProfile.create({
    data: { userId, name: 'Front-end', keywords: ['react'], sourceIds: [E2E_SOURCE.id] },
  });
  const job = await db.job.create({
    data: {
      dedupeHash: e2eId('vaga'),
      title: 'Desenvolvedora React',
      company: 'Empresa Exemplo',
      description: 'Vaga de React com TypeScript.',
      sources: {
        create: { sourceId: E2E_SOURCE.id, externalId: e2eId('ext'), url: 'https://exemplo.test' },
      },
    },
  });
  await db.jobMatch.create({
    data: {
      jobId: job.id,
      searchProfileId: profile.id,
      score: 92,
      reasons: ['Palavras-chave: react'],
    },
  });
  return { job, profile };
}

/** Simula o `job-requirements`: os requisitos extraídos pela IA ficam gravados na vaga. */
export async function simulateJobRequirements(jobId: string, requirements: JobRequirement[]) {
  await db.job.update({ where: { id: jobId }, data: { requirements: { requirements } } });
}

/**
 * Simula o `company-detect`: a última empresa sugerida pelo usuário usava um ATS lido por board
 * e entrou no catálogo da fonte do E2E.
 */
export async function simulateCompanyDetected(userId: string) {
  const suggestion = await db.companySuggestion.findFirstOrThrow({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const board = await db.careerBoard.create({
    data: { sourceId: E2E_SOURCE.id, token: e2eId('empresa') },
  });
  await db.companySuggestion.update({
    where: { id: suggestion.id },
    data: { status: 'added', sourceId: E2E_SOURCE.id, careerBoardId: board.id },
  });
  return board;
}

/** Simula o `apply` (modo assistido) e o `notify`: a candidatura pede ação e vira alerta. */
export async function simulateAssistedApply(userId: string) {
  const application = await db.application.findFirstOrThrow({ where: { userId } });
  await db.application.update({ where: { id: application.id }, data: { status: 'needs_action' } });
  await db.notification.create({
    data: {
      userId,
      kind: 'needs_action',
      data: { applicationId: application.id },
      dedupeKey: `needs_action_${application.id}`,
    },
  });
}

/** Fontes que o teste do admin cria e desliga; a `E2E_SOURCE` dos outros testes fica intacta. */
const ADMIN_SOURCE_PREFIX = `${E2E_PREFIX}admin-`;

/**
 * Conta com o papel ADMIN e uma fonte própria com duas execuções nas últimas 24 horas,
 * uma com erro, como a ingestão gravaria.
 */
export async function seedAdminScenario(userId: string) {
  await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  const source = await db.source.create({
    data: {
      id: `${ADMIN_SOURCE_PREFIX}${randomUUID()}`,
      displayName: 'ATS de teste do admin',
      kind: 'api',
      applyModes: ['assisted'],
    },
  });
  const now = Date.now();
  await db.sourceRun.createMany({
    data: [
      { status: 'success', found: 12, changed: 3, startedAt: new Date(now - 60_000) },
      {
        status: 'failed',
        error: 'HTTP 503 em https://ats.test',
        startedAt: new Date(now - 120_000),
      },
    ].map((run) => ({ ...run, sourceId: source.id, target: 'empresa-x', durationMs: 1500 })),
  });
  return source;
}

/** Apaga o que sobrou de execuções anteriores (as vagas não pertencem a um usuário). */
export async function removeE2eLeftovers() {
  await db.user.deleteMany({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } });
  await db.job.deleteMany({ where: { dedupeHash: { startsWith: E2E_PREFIX } } });
  await db.careerBoard.deleteMany({ where: { token: { startsWith: E2E_PREFIX } } });
  // a cascata a partir da fonte leva as execuções e o catálogo dela
  await db.source.deleteMany({ where: { id: { startsWith: ADMIN_SOURCE_PREFIX } } });
}
