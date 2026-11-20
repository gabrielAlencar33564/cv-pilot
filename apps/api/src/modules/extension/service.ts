import {
  CoverLetterStatus,
  type ExtensionApplication,
  type ExtensionProfile,
} from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';
import { readProfileLinks } from '../account/service';
import { loadOwnedResumeFile } from '../resumes/service';

/** O que a extensão preenche nos formulários: o perfil base, com o e-mail do login (RF-02). */
export async function extensionProfile(userId: string): Promise<ExtensionProfile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      city: true,
      links: true,
      salaryExpectation: true,
      availability: true,
    },
  });
  return { ...user, links: readProfileLinks(user.links) };
}

/** `Application.answers` é JSON livre no banco: só sai o que é pergunta → resposta em texto. */
const Answers = z.record(z.string(), z.string());

/**
 * Candidaturas que esperam o candidato (RF-53): o modo assistido e os envios que pararam num
 * bloqueio. Cada uma leva a página da vaga no site de onde saiu.
 */
export async function listPendingApplications(userId: string): Promise<ExtensionApplication[]> {
  const applications = await prisma.application.findMany({
    where: { userId, status: 'needs_action' },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      sourceId: true,
      coverLetter: true,
      coverLetterStatus: true,
      answers: true,
      job: {
        select: { title: true, company: true, sources: { select: { sourceId: true, url: true } } },
      },
      source: { select: { displayName: true } },
      resumeVersion: {
        select: {
          version: true,
          fileName: true,
          mimeType: true,
          resume: { select: { name: true } },
        },
      },
    },
  });

  return applications.flatMap((a) => {
    const url = (a.job.sources.find((s) => s.sourceId === a.sourceId) ?? a.job.sources[0])?.url;
    // vaga sem nenhuma página conhecida: não há onde preencher
    if (!url) return [];
    return [
      {
        id: a.id,
        url,
        job: { title: a.job.title, company: a.job.company },
        source: a.source,
        coverLetter: a.coverLetter,
        coverLetterStatus: CoverLetterStatus.safeParse(a.coverLetterStatus).data ?? null,
        answers: Answers.safeParse(a.answers).data ?? {},
        resume: {
          name: a.resumeVersion.resume.name,
          version: a.resumeVersion.version,
          fileName: a.resumeVersion.fileName,
          mimeType: a.resumeVersion.mimeType,
        },
      },
    ];
  });
}

/** O arquivo da versão do currículo que vai nesta candidatura, decifrado, só para o dono. */
export async function pendingApplicationResume(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId, status: 'needs_action' },
    select: { resumeVersion: { select: { id: true, resumeId: true } } },
  });
  if (!application) throw new HttpError(404, 'application_not_found');
  const { id, resumeId } = application.resumeVersion;
  return loadOwnedResumeFile(userId, resumeId, id);
}
