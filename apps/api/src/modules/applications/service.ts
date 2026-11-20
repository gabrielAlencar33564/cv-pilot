import { ApplicationStatus, type ApplicationUpdateInput } from '@cv-pilot/contracts';
import { canEditCoverLetter, canTransition, manualTransitions } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

/** Status guardado como texto no banco; um valor fora do enum não ganha transição nenhuma. */
const transitionsFrom = (status: string) => {
  const parsed = ApplicationStatus.safeParse(status);
  return parsed.success ? manualTransitions(parsed.data) : [];
};

/** Status fora do enum não deixa mexer na carta. */
const letterEditable = (status: string) => {
  const parsed = ApplicationStatus.safeParse(status);
  return parsed.success && canEditCoverLetter(parsed.data);
};

/** Painel de candidaturas (kanban), com as mudanças de status que o candidato pode fazer. */
export async function listApplications(userId: string, status?: ApplicationStatus) {
  const applications = await prisma.application.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    include: {
      job: { select: { title: true, company: true } },
      source: { select: { displayName: true } },
      resumeVersion: { select: { version: true, resume: { select: { name: true } } } },
    },
  });
  return applications.map(withActions);
}

const withActions = <T extends { status: string }>(application: T) => ({
  ...application,
  allowedTransitions: transitionsFrom(application.status),
  coverLetterEditable: letterEditable(application.status),
});

/**
 * A carta nova do candidato vence a IA (`edited`; o worker só grava sobre `generating`). Uma
 * candidatura que sai antes de a IA terminar fica com a carta que tinha.
 */
function letterChange(
  current: { coverLetterStatus: string | null },
  input: ApplicationUpdateInput,
  nextStatus: ApplicationStatus | undefined,
) {
  if (input.coverLetter !== undefined) {
    return { coverLetter: input.coverLetter || null, coverLetterStatus: 'edited' };
  }
  if (nextStatus && !canEditCoverLetter(nextStatus) && current.coverLetterStatus === 'generating') {
    return { coverLetterStatus: null };
  }
  return {};
}

/**
 * Atualização manual (RF-62): só as transições da máquina de estados (409 nas demais).
 * Cada mudança de status entra no histórico da candidatura. A carta muda até o envio (RF-54).
 */
export async function updateApplication(userId: string, id: string, input: ApplicationUpdateInput) {
  const current = await prisma.application.findFirst({
    where: { id, userId },
    select: { status: true, log: true, coverLetterStatus: true },
  });
  if (!current) throw new HttpError(404, 'application_not_found');
  if (input.coverLetter !== undefined && !letterEditable(current.status)) {
    throw new HttpError(409, 'cover_letter_locked');
  }

  // mandar o mesmo status de volta não é transição: só as anotações mudam
  const nextStatus = input.status !== current.status ? input.status : undefined;
  if (nextStatus) {
    const from = ApplicationStatus.safeParse(current.status);
    if (!from.success || !canTransition(from.data, nextStatus)) {
      throw new HttpError(409, 'invalid_status_transition');
    }
  }

  const log = Array.isArray(current.log) ? current.log : [];
  const updated = await prisma.application.update({
    where: { id },
    data: {
      ...(nextStatus
        ? {
            status: nextStatus,
            log: [
              ...log,
              {
                at: new Date().toISOString(),
                type: 'status_changed',
                from: current.status,
                to: nextStatus,
              },
            ],
          }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...letterChange(current, input, nextStatus),
    },
  });
  return withActions(updated);
}
