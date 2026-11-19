import type { DismissReason, ResumeParseStatus } from '@cv-pilot/contracts';

export const workModelLabels: Record<string, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
};

export const seniorityLabels: Record<string, string> = {
  intern: 'Estágio',
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
  lead: 'Liderança técnica',
  manager: 'Gestão',
};

export const toneLabels: Record<string, string> = {
  technical: 'Técnico',
  humanized: 'Humanizado',
  formal: 'Formal',
  direct: 'Direto',
};

export const modeLabels: Record<string, string> = {
  api: 'Automático (API)',
  email: 'E-mail',
  assisted: 'Assistido',
};

export const statusLabels: Record<string, string> = {
  suggested: 'Sugerida',
  queued: 'Na fila',
  needs_action: 'Ação necessária',
  sent: 'Enviada',
  in_process: 'Em processo',
  interview: 'Entrevista',
  offer: 'Oferta',
  rejected: 'Recusada',
  no_response: 'Sem resposta',
  failed: 'Falhou',
};

export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Estado da extração de uma versão de currículo; a cor acompanha o texto, nunca o substitui. */
export const parseStatusLabels: Record<ResumeParseStatus, { label: string; color: string }> = {
  pending: { label: 'Extraindo dados', color: 'blue' },
  parsed: { label: 'Dados extraídos', color: 'green' },
  failed: { label: 'Falha na extração', color: 'red' },
};

/** Motivos do "não tenho interesse" (RF-42). */
export const dismissReasonLabels: Record<DismissReason, string> = {
  not_interested: 'Não tenho interesse',
  salary: 'Salário',
  location: 'Local',
  seniority: 'Senioridade',
  company: 'Empresa',
  other: 'Outro motivo',
};
