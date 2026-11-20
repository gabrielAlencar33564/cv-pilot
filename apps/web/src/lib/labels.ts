import type {
  CompanySuggestionStatus,
  CoverLetterStatus,
  DismissReason,
  ResumeParseStatus,
  SourceHealth,
  SourceRunStatus,
} from '@cv-pilot/contracts';

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

export const contractTypeLabels: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  internship: 'Estágio',
  temporary: 'Temporário',
  freelance: 'Freelance',
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

/** De onde veio a carta da candidatura (RF-54); a cor acompanha o texto, nunca o substitui. */
export const coverLetterStatusLabels: Record<CoverLetterStatus, { label: string; color: string }> =
  {
    generating: { label: 'IA escrevendo a carta', color: 'blue' },
    generated: { label: 'Carta escrita pela IA', color: 'violet' },
    failed: { label: 'IA não escreveu a carta', color: 'red' },
    edited: { label: 'Carta editada por você', color: 'gray' },
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

/** Saúde de uma fonte no admin (RF-80); a cor acompanha o texto. */
export const sourceHealthLabels: Record<SourceHealth, { label: string; color: string }> = {
  healthy: { label: 'Saudável', color: 'green' },
  degraded: { label: 'Instável', color: 'yellow' },
  failing: { label: 'Falhando', color: 'red' },
  idle: { label: 'Sem execuções', color: 'gray' },
  paused: { label: 'Pausada', color: 'gray' },
};

/** Resultado de uma execução de ingestão. */
export const sourceRunStatusLabels: Record<SourceRunStatus, { label: string; color: string }> = {
  success: { label: 'Sucesso', color: 'green' },
  failed: { label: 'Erro', color: 'red' },
  blocked: { label: 'Bloqueada', color: 'red' },
  rate_limited: { label: 'Limite do site', color: 'yellow' },
};

/** O que o detector achou na página de carreiras sugerida ("Adicionar empresa"). */
export const companySuggestionStatusLabels: Record<
  CompanySuggestionStatus,
  { label: string; color: string }
> = {
  pending: { label: 'Analisando', color: 'blue' },
  added: { label: 'No catálogo', color: 'green' },
  covered: { label: 'Já coberta', color: 'teal' },
  not_detected: { label: 'Não encontrada', color: 'gray' },
  unreachable: { label: 'Inacessível', color: 'orange' },
};
