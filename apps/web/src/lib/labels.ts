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
