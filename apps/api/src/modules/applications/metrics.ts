import { applicationMetrics } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';

/**
 * Métricas do candidato (RF-63). As candidaturas de uma pessoa são poucas (centenas), então o
 * funil é montado em memória pela regra do core, que lê o histórico de status de cada uma.
 */
export async function getApplicationMetrics(userId: string) {
  const applications = await prisma.application.findMany({
    where: { userId },
    select: {
      status: true,
      sentAt: true,
      log: true,
      source: { select: { id: true, displayName: true } },
      resumeVersion: { select: { resume: { select: { id: true, name: true } } } },
    },
  });
  return applicationMetrics(
    applications.map((a) => ({
      status: a.status,
      sentAt: a.sentAt,
      log: a.log,
      resume: a.resumeVersion.resume,
      source: { id: a.source.id, name: a.source.displayName },
    })),
  );
}
