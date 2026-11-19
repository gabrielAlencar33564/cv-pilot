import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import { logger } from '../logger';
import { enqueueDailyDigests } from './digest';

/**
 * Roda a cada 5 min: para cada perfil ativo cuja próxima busca venceu,
 * enfileira uma busca por fonte (site) selecionada. Também solta o resumo diário de vagas.
 */
export async function schedulerTick() {
  const now = Date.now();
  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, user: { deletedAt: null } },
    select: { id: true, sourceIds: true, frequencyMinutes: true, lastSearchedAt: true },
  });
  const activeSources = new Set(
    (await prisma.source.findMany({ where: { active: true }, select: { id: true } })).map(
      (s) => s.id,
    ),
  );

  let enqueued = 0;
  for (const p of profiles) {
    const due =
      !p.lastSearchedAt || p.lastSearchedAt.getTime() + p.frequencyMinutes * 60_000 <= now;
    if (!due) continue;

    for (const sourceId of p.sourceIds.filter((s) => activeSources.has(s))) {
      // jobId determinístico evita duplicar a mesma busca dentro da janela
      const bucket = Math.floor(now / (p.frequencyMinutes * 60_000));
      await enqueue(
        'search',
        { searchProfileId: p.id, sourceId },
        { jobId: `search_${p.id}_${sourceId}_${bucket}` },
      );
      enqueued++;
    }
    await prisma.searchProfile.update({
      where: { id: p.id },
      data: { lastSearchedAt: new Date(now) },
    });
  }
  const digests = await enqueueDailyDigests(new Date(now));
  logger.info({ profiles: profiles.length, enqueued, digests }, 'scheduler tick');
}
