import { dailyBucket, localHour } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';

/** Hora local em que sai o resumo diário de vagas novas (RF-70). */
const DIGEST_HOUR = 8;

/**
 * Enfileira o resumo diário de quem tem perfil ativo e está às 8h no próprio fuso.
 * O tick roda a cada 5 min dentro dessa hora; o jobId por usuário e dia deixa passar um só.
 */
export async function enqueueDailyDigests(now: Date): Promise<number> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, searchProfiles: { some: { active: true } } },
    select: { id: true, timezone: true },
  });

  let enqueued = 0;
  for (const user of users) {
    if (localHour(now, user.timezone) !== DIGEST_HOUR) continue;
    const day = dailyBucket(now, user.timezone);
    await enqueue(
      'notify',
      { kind: 'new_jobs', userId: user.id, day },
      { jobId: `notify_new_jobs_${user.id}_${day}` },
    );
    enqueued++;
  }
  return enqueued;
}
