/**
 * Funil das candidaturas enviadas (RF-63). Cada etapa conta as candidaturas que chegaram a ela
 * em algum momento, mesmo que depois tenham mudado de status: uma entrevista que terminou em
 * recusa conta como resposta e como entrevista.
 */
export interface FunnelCounts {
  sent: number;
  /** a empresa respondeu: em processo, entrevista, oferta ou recusa */
  responded: number;
  /** chegou à entrevista ou à oferta */
  interviews: number;
  offers: number;
}

export interface FunnelByResume extends FunnelCounts {
  resumeId: string;
  resumeName: string;
}

export interface FunnelBySource extends FunnelCounts {
  sourceId: string;
  sourceName: string;
}

export type FunnelByResumeAndSource = FunnelByResume & FunnelBySource;

/** Métricas do candidato: qual currículo funciona melhor em qual site (RF-63). */
export interface ApplicationMetrics {
  totals: FunnelCounts;
  byResume: FunnelByResume[];
  bySource: FunnelBySource[];
  byResumeAndSource: FunnelByResumeAndSource[];
}

/**
 * Situação do follow-up de uma candidatura enviada: `due` = passou o prazo sem resposta e vale
 * cobrar a empresa; `stale` = já cobrou e continua sem resposta, então pode ir para "Sem resposta".
 */
export type FollowUpState = 'due' | 'stale';
