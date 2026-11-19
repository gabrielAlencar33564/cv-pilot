import type { ApplicationStatus } from '@cv-pilot/contracts';

/**
 * Para onde o candidato pode mover uma candidatura à mão (RF-60, RF-62).
 * - `queued` nunca é escolha manual: entrar na fila passa pelo limite diário (candidatar-se).
 * - `sent` à mão só a partir de "Ação necessária": no modo assistido, é o candidato quem
 *   conclui o envio no site.
 * - Recusada e sem resposta podem ser reabertas, porque a empresa às vezes volta depois.
 */
const MANUAL_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  suggested: [],
  queued: [],
  needs_action: ['sent', 'failed'],
  sent: ['in_process', 'interview', 'offer', 'rejected', 'no_response'],
  in_process: ['interview', 'offer', 'rejected', 'no_response'],
  interview: ['in_process', 'offer', 'rejected', 'no_response'],
  offer: ['rejected'],
  rejected: ['in_process', 'interview'],
  no_response: ['in_process', 'interview', 'rejected'],
  failed: ['needs_action'],
};

export function manualTransitions(from: ApplicationStatus): readonly ApplicationStatus[] {
  return MANUAL_TRANSITIONS[from];
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return MANUAL_TRANSITIONS[from].includes(to);
}
