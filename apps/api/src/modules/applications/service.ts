import { ApplicationStatus, type ApplicationUpdateInput } from '@cv-pilot/contracts';
import { canTransition, manualTransitions } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

/** Status guardado como texto no banco; um valor fora do enum não ganha transição nenhuma. */
const transitionsFrom = (status: string) => {
  const parsed = ApplicationStatus.safeParse(status);
  return parsed.success ? manualTransitions(parsed.data) : [];
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
  return applications.map((a) => ({ ...a, allowedTransitions: transitionsFrom(a.status) }));
}

/**
 * Atualização manual (RF-62): só as transições da máquina de estados (409 nas demais).
 * Cada mudança de status entra no histórico da candidatura.
 */
export async function updateApplication(userId: string, id: string, input: ApplicationUpdateInput) {
  const current = await prisma.application.findFirst({
    where: { id, userId },
    select: { status: true, log: true },
  });
  if (!current) throw new HttpError(404, 'application_not_found');

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
    },
  });
  return { ...updated, allowedTransitions: transitionsFrom(updated.status) };
}
