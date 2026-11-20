import type { FollowUpState } from '@cv-pilot/contracts';

const DAY_MS = 24 * 3600_000;
/** Dias sem resposta depois do envio até valer cobrar a empresa. */
const FOLLOW_UP_AFTER_DAYS = 7;
/** Dias sem resposta depois do follow-up até sugerir "Sem resposta". */
const NO_RESPONSE_AFTER_FOLLOW_UP_DAYS = 7;

interface FollowUpApplication {
  status: string;
  sentAt: Date | null;
  followedUpAt: Date | null;
}

/** Enviada até este instante, a candidatura já pede follow-up em `at`. */
export function followUpSentCutoff(at: Date): Date {
  return new Date(at.getTime() - FOLLOW_UP_AFTER_DAYS * DAY_MS);
}

/**
 * Só a candidatura parada em "Enviada" pede follow-up: qualquer retorno da empresa a tira dali.
 * Null enquanto o prazo não venceu (ou quando não se aplica).
 */
export function followUpState(application: FollowUpApplication, now: Date): FollowUpState | null {
  if (application.status !== 'sent' || !application.sentAt) return null;
  if (!application.followedUpAt) {
    return application.sentAt <= followUpSentCutoff(now) ? 'due' : null;
  }
  const staleAt = application.followedUpAt.getTime() + NO_RESPONSE_AFTER_FOLLOW_UP_DAYS * DAY_MS;
  return staleAt <= now.getTime() ? 'stale' : null;
}

interface FollowUpValues {
  cargo: string;
  empresa: string;
  nome: string;
}

/**
 * Mensagem pronta para cobrar a empresa, sem gênero nem data, para servir em qualquer canal
 * (e-mail do recrutador, LinkedIn, o próprio site). Só diz o que é verdade: que houve a
 * candidatura e que o interesse continua.
 */
export function followUpMessage({ cargo, empresa, nome }: FollowUpValues): string {
  return [
    'Olá! Tudo bem?',
    `Recentemente me candidatei à vaga de ${cargo} na ${empresa} e sigo com muito interesse na oportunidade. Gostaria de saber se há novidades sobre o processo seletivo e se posso enviar alguma informação adicional.`,
    // conta antiga, sem nome no cadastro: a mensagem sai sem assinatura
    ['Agradeço a atenção!', nome.trim()].filter(Boolean).join('\n'),
  ].join('\n\n');
}
