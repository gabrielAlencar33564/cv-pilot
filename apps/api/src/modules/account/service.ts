import { TERMS_VERSION } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';

/** O usuário aceitou a versão atual dos termos de uso e da política de privacidade? */
export async function hasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  const consent = await prisma.consentLog.findFirst({
    where: { userId, termsVersion: TERMS_VERSION },
    select: { id: true },
  });
  return consent !== null;
}

/** Registra o aceite (versão, data e IP), uma vez por versão. */
export async function acceptCurrentTerms(userId: string, ip: string) {
  const existing = await prisma.consentLog.findFirst({
    where: { userId, termsVersion: TERMS_VERSION },
  });
  return (
    existing ?? prisma.consentLog.create({ data: { userId, termsVersion: TERMS_VERSION, ip } })
  );
}
