import {
  SourceBlockedError,
  SourceDisallowedError,
  SourceHttpError,
  UnsafeUrlError,
  assertPublicUrl,
  createPoliteFetch,
  findAtsInHtml,
  getAdapter,
  recognizeAtsUrl,
  type AtsMatch,
} from '@cv-pilot/adapters';
import type { CompanySuggestionStatus } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { getRedis, type QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { createHostThrottle } from '../host-throttle';
import { isLastAttempt } from '../job-attempts';
import { logger } from '../logger';
import { createRobotsCache } from '../robots-cache';
import { sourceContext } from '../source-context';

/** O site da empresa não é uma fonte: uma requisição a cada 5 s por host, como um visitante. */
const COMPANY_SITE_INTERVAL_MS = 5_000;
/** Os links do ATS estão no HTML da página; o resto de uma página gigante não interessa. */
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

interface Outcome {
  status: Exclude<CompanySuggestionStatus, 'pending'>;
  sourceId?: string;
  careerBoardId?: string;
}

/**
 * "Adicionar empresa": reconhece o ATS da página de carreiras sugerida e, se for uma fonte lida
 * por board, inclui a empresa no catálogo depois de conferir que o board existe. O endereço vem
 * do usuário: toda requisição ao site dele passa pela guarda contra endereços internos e pelo
 * robots.txt, e um bloqueio nunca é contornado.
 */
export async function companyDetectProcessor(job: Job<QueuePayloads['company-detect']>) {
  const { suggestionId } = job.data;
  const suggestion = await prisma.companySuggestion.findUnique({
    where: { id: suggestionId },
    select: { url: true, status: true },
  });
  if (suggestion?.status !== 'pending') return { skipped: true };

  let outcome: Outcome;
  try {
    const match = recognizeAtsUrl(suggestion.url) ?? (await scanCareersPage(suggestion.url));
    outcome = await resolveMatch(match);
  } catch (err) {
    if (
      err instanceof UnsafeUrlError ||
      err instanceof SourceBlockedError ||
      err instanceof SourceDisallowedError
    ) {
      logger.info({ suggestionId, reason: err.name }, 'página de carreiras inacessível ao bot');
      outcome = { status: 'unreachable' };
    } else {
      if (isLastAttempt(job)) await save(suggestionId, { status: 'unreachable' });
      throw err;
    }
  }

  await save(suggestionId, outcome);
  logger.info({ suggestionId, ...outcome }, 'empresa sugerida analisada');
  return outcome;
}

async function save(suggestionId: string, outcome: Outcome) {
  await prisma.companySuggestion.update({ where: { id: suggestionId }, data: outcome });
}

/** Baixa a página de carreiras e procura os links e embeds de ATS no HTML. */
async function scanCareersPage(url: string): Promise<AtsMatch | null> {
  const http = createPoliteFetch({
    throttle: createHostThrottle(getRedis(), COMPANY_SITE_INTERVAL_MS),
    robots: createRobotsCache(getRedis()),
    guard: (target) => assertPublicUrl(target),
  });
  const res = await http(url, { headers: { Accept: 'text/html' } });
  const matches = findAtsInHtml(await readCapped(res, MAX_PAGE_BYTES));
  // uma empresa que também aparece na Gupy, mas tem board próprio, entra pelo board
  return matches.find((m) => m.kind === 'board') ?? matches[0] ?? null;
}

/** Lê o corpo até `maxBytes` e descarta o resto, sem guardar a página inteira na memória. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  // o tipo do corpo no DOM é ReadableStream<any>; o fetch do Node entrega bytes
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

async function resolveMatch(match: AtsMatch | null): Promise<Outcome> {
  if (!match) return { status: 'not_detected' };
  if (match.kind === 'covered') return { status: 'covered', sourceId: match.sourceId };

  const source = await prisma.source.findUnique({
    where: { id: match.sourceId },
    select: { rateLimitReqs: true, rateLimitMs: true },
  });
  if (!source || !(await boardExists(match.sourceId, match.token, source))) {
    return { status: 'not_detected', sourceId: match.sourceId };
  }
  // o admin pode ter desligado este board de propósito: a sugestão não o religa
  const board = await prisma.careerBoard.upsert({
    where: { sourceId_token: { sourceId: match.sourceId, token: match.token } },
    create: { sourceId: match.sourceId, token: match.token },
    update: {},
    select: { id: true },
  });
  return { status: 'added', sourceId: match.sourceId, careerBoardId: board.id };
}

/** Pede a primeira vaga do board pela API do ATS. Board vazio existe; 404 não. */
async function boardExists(
  sourceId: string,
  token: string,
  source: { rateLimitReqs: number; rateLimitMs: number },
): Promise<boolean> {
  // o mesmo ritmo da ingestão desta fonte
  const ctx = sourceContext(sourceId, source, 1);
  try {
    await getAdapter(sourceId).fetch(token, ctx)[Symbol.asyncIterator]().next();
    return true;
  } catch (err) {
    if (err instanceof SourceHttpError && err.status === 404) return false;
    throw err;
  }
}
