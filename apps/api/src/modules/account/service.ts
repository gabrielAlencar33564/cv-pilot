import { ProfileLinks, TERMS_VERSION } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { deleteResumeFile } from '@cv-pilot/storage';

/** Data do aceite da versão atual dos termos, ou null se o usuário ainda não aceitou. */
export async function currentTermsAcceptedAt(userId: string): Promise<Date | null> {
  const consent = await prisma.consentLog.findFirst({
    where: { userId, termsVersion: TERMS_VERSION },
    select: { acceptedAt: true },
  });
  return consent?.acceptedAt ?? null;
}

export async function hasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  return (await currentTermsAcceptedAt(userId)) !== null;
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

/** `User.links` é JSON livre no banco: só sai o que o contrato aceita. */
export const readProfileLinks = (links: unknown): ProfileLinks =>
  ProfileLinks.safeParse(links).data ?? {};

/** Caminho na API do arquivo de uma versão de currículo (decifrado, só para o dono). */
const resumeFilePath = (resumeId: string, versionId: string) =>
  `/resumes/${resumeId}/versions/${versionId}/file`;

/**
 * Todos os dados da conta (RF-04), em JSON. Fica de fora só o que é segredo do login: o hash
 * da senha e os tokens de sessão. Os currículos vêm como caminhos para baixar o arquivo.
 */
export async function exportUserData(userId: string) {
  const { links, resumes, ...user } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      city: true,
      links: true,
      salaryExpectation: true,
      availability: true,
      timezone: true,
      createdAt: true,
      consents: { select: { termsVersion: true, acceptedAt: true, ip: true } },
      sessions: { select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } },
      searchProfiles: {
        include: {
          matches: { select: { jobId: true, score: true, reasons: true, dismissed: true } },
        },
      },
      resumes: {
        include: {
          versions: {
            select: {
              id: true,
              version: true,
              fileName: true,
              mimeType: true,
              parsed: true,
              parseStatus: true,
              createdAt: true,
            },
          },
        },
      },
      coverLetterTemplates: true,
      sendRules: true,
      applications: { include: { job: { select: { title: true, company: true } } } },
      notifications: { select: { kind: true, data: true, readAt: true, createdAt: true } },
      companySuggestions: { select: { url: true, status: true, sourceId: true, createdAt: true } },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    ...user,
    links: readProfileLinks(links),
    resumes: resumes.map((resume) => ({
      ...resume,
      versions: resume.versions.map((v) => ({ ...v, file: resumeFilePath(resume.id, v.id) })),
    })),
  };
}

/**
 * Apaga do S3 todos os arquivos de currículo do usuário, antes de excluir a conta (RF-04).
 * Se um arquivo falhar, a exclusão para e a conta fica como estava, para tentar de novo.
 */
export async function deleteUserFiles(userId: string): Promise<void> {
  const versions = await prisma.resumeVersion.findMany({
    where: { resume: { userId } },
    select: { storageKey: true },
  });
  for (const { storageKey } of versions) await deleteResumeFile(storageKey);
}
