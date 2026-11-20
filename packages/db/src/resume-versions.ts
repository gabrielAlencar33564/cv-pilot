import { prisma } from './client';

/**
 * O currículo comparado com uma vaga: a última versão lida do currículo da regra de envio ou,
 * sem regra (ou sem versão lida nele), a última versão lida de qualquer currículo do usuário.
 * O match (semelhança) e o "o que falta" da vaga usam a mesma escolha.
 */
export async function comparisonResumeVersion(userId: string, resumeId: string | null) {
  const latestParsed = (resume: { userId: string; id?: string }) =>
    prisma.resumeVersion.findFirst({
      where: { parseStatus: 'parsed', resume },
      orderBy: { parsedAt: 'desc' },
      select: { id: true, parsed: true },
    });
  return (
    (resumeId ? await latestParsed({ userId, id: resumeId }) : null) ??
    (await latestParsed({ userId }))
  );
}
