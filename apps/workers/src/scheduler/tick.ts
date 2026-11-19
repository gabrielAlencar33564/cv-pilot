import { createHash } from 'node:crypto';
import { getAdapter } from '@cv-pilot/adapters';
import { planIngestion, type IngestTarget } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import { expireStaleJobs } from '../job-expiration';
import { logger } from '../logger';
import { enqueueDailyDigests } from './digest';

/**
 * Janela do id dos jobs de ingestão: um board ou uma palavra-chave é baixado no máximo uma vez
 * por janela, por mais perfis que vençam nela. Igual à frequência mínima de um perfil (60 min).
 */
const INGEST_WINDOW_MS = 60 * 60_000;

interface DueProfile {
  id: string;
  sourceIds: string[];
  keywords: string[];
  lastSearchedAt: Date | null;
}

/**
 * Roda a cada 5 min. Com os perfis cuja busca venceu, monta o que baixar (cada board ou
 * palavra-chave uma vez só) e enfileira a ingestão. Perfil novo, editado ou reativado (sem
 * `lastSearchedAt`) ganha também o backfill contra as vagas que já estão no banco. Depois
 * expira as vagas que ninguém vê há dias e solta o resumo diário.
 */
export async function schedulerTick() {
  const now = Date.now();
  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, user: { deletedAt: null } },
    select: {
      id: true,
      sourceIds: true,
      keywords: true,
      frequencyMinutes: true,
      lastSearchedAt: true,
    },
  });
  const due: DueProfile[] = profiles.filter(
    (p) => !p.lastSearchedAt || p.lastSearchedAt.getTime() + p.frequencyMinutes * 60_000 <= now,
  );

  const window = Math.floor(now / INGEST_WINDOW_MS);
  const targets = planIngestion(due, await ingestSources(due));
  for (const target of targets) {
    await enqueue('ingest', target, { jobId: ingestJobId(target, window) });
  }
  const newProfiles = due.filter((p) => !p.lastSearchedAt);
  for (const p of newProfiles) {
    await enqueue('backfill', { searchProfileId: p.id }, { jobId: `backfill_${p.id}_${window}` });
  }
  if (due.length) {
    await prisma.searchProfile.updateMany({
      where: { id: { in: due.map((p) => p.id) } },
      data: { lastSearchedAt: new Date(now) },
    });
  }

  const expired = await expireStaleJobs(new Date(now));
  const digests = await enqueueDailyDigests(new Date(now));
  logger.info(
    {
      profiles: profiles.length,
      due: due.length,
      ingests: targets.length,
      backfills: newProfiles.length,
      ...expired,
      digests,
    },
    'scheduler tick',
  );
}

/** Fontes ativas usadas pelos perfis vencidos, com o jeito de percorrer cada uma. */
async function ingestSources(due: readonly DueProfile[]) {
  const wanted = [...new Set(due.flatMap((p) => p.sourceIds))];
  if (!wanted.length) return [];
  const sources = await prisma.source.findMany({
    where: { active: true, id: { in: wanted } },
    select: { id: true },
  });
  const withAdapter = sources.flatMap(({ id }) => {
    try {
      return [{ id, fetchBy: getAdapter(id).fetchBy }];
    } catch (err) {
      // fonte ativa no banco sem adapter no código: as outras seguem
      logger.warn({ err, sourceId: id }, 'fonte ativa sem adapter registrado');
      return [];
    }
  });

  const boardSourceIds = withAdapter.filter((s) => s.fetchBy === 'board').map((s) => s.id);
  const boards = boardSourceIds.length
    ? await prisma.careerBoard.findMany({
        where: { active: true, sourceId: { in: boardSourceIds } },
        select: { id: true, sourceId: true },
      })
    : [];
  return withAdapter.map((s) => ({
    ...s,
    careerBoardIds: boards.filter((b) => b.sourceId === s.id).map((b) => b.id),
  }));
}

/** O BullMQ não aceita qualquer texto no id: a palavra-chave entra como hash curto. */
function ingestJobId(target: IngestTarget, window: number) {
  const key =
    'careerBoardId' in target
      ? target.careerBoardId
      : createHash('sha256').update(target.keyword).digest('hex').slice(0, 16);
  return `ingest_${target.sourceId}_${key}_${window}`;
}
