import { dailyBucket, localHour } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';

/** Hora local em que sai o resumo diário (RF-70). */
const DIGEST_HOUR = 8;
/** O que o resumo diário confere: vagas novas e candidaturas que pedem follow-up. */
const DIGEST_KINDS = ['new_jobs', 'follow_ups'] as const;

/**
 * Enfileira o resumo diário de quem está às 8h no próprio fuso e tem perfil ativo ou
 * candidatura esperando resposta. Cada tipo de resumo conta à parte e não sai se der zero.
 * O tick roda a cada 5 min dentro dessa hora; o jobId por usuário, tipo e dia deixa passar um só.
 */
export async function enqueueDailyDigests(now: Date): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { searchProfiles: { some: { active: true } } },
        { applications: { some: { status: 'sent' } } },
      ],
    },
    select: { id: true, timezone: true },
  });

  let enqueued = 0;
  for (const user of users) {
    if (localHour(now, user.timezone) !== DIGEST_HOUR) continue;
    const day = dailyBucket(now, user.timezone);
    for (const kind of DIGEST_KINDS) {
      await enqueue(
        'notify',
        { kind, userId: user.id, day },
        { jobId: `notify_${kind}_${user.id}_${day}` },
      );
    }
    enqueued++;
  }
  return enqueued;
}
