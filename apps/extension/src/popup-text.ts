import type { FillReport } from './fill/messages';

/** Mensagens para os códigos de erro da API e do preenchimento; os demais aparecem genéricos. */
const ERRORS: Record<string, string> = {
  unauthorized: 'Chave inválida ou desconectada. Gere outra em Minha conta, no site do CV Pilot.',
  consent_required: 'Aceite os termos atualizados no site do CV Pilot para continuar.',
  network_error: 'Não consegui falar com o CV Pilot. Confira a conexão e tente de novo.',
  application_not_found: 'Esta candidatura não está mais em "Ação necessária".',
  invalid_status_transition: 'Esta candidatura já mudou de etapa. Atualize a lista.',
  no_tab: 'Abra a vaga antes de pedir o preenchimento.',
  page_not_allowed: 'O navegador não deixa preencher esta página.',
  invalid_token: 'Isso não parece uma chave do CV Pilot. Copie de novo em Minha conta.',
};

export const errorMessage = (code: string) =>
  ERRORS[code] ?? 'Algo deu errado. Tente de novo em instantes.';

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

/** O resumo do preenchimento: o que foi feito e o que o candidato ainda precisa fazer. */
export function fillSummary(report: FillReport): string {
  if (report.filled.length === 0 && !report.resumeAttached) {
    return 'Não achei campos para preencher nesta página. Se a vaga pede para clicar em "Candidatar-se", clique e peça de novo.';
  }
  const done = [
    report.filled.length > 0 ? `preenchi ${plural(report.filled.length, 'campo', 'campos')}` : '',
    report.resumeAttached ? 'anexei o currículo' : '',
  ]
    .filter(Boolean)
    .join(' e ');
  const pending =
    report.requiredEmpty > 0
      ? ` Ainda há ${plural(report.requiredEmpty, 'campo obrigatório vazio', 'campos obrigatórios vazios')}.`
      : '';
  return `${done.charAt(0).toUpperCase()}${done.slice(1)}.${pending} Confira tudo e envie no site.`;
}
