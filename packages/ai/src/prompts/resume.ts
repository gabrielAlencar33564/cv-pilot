import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ResumeDocument } from '../types';

/** Parte estável do pedido. Os dados do candidato vão só na mensagem do usuário. */
export const RESUME_SYSTEM_PROMPT = [
  'Você extrai dados estruturados de currículos para uma plataforma brasileira de busca de vagas.',
  'Regras:',
  '- Use somente o que está escrito no currículo. Não invente, não complete e não deduza empresa, cargo, data, curso, idioma ou habilidade.',
  '- Campo que não aparece no currículo fica null; lista sem itens fica vazia.',
  '- Não extraia CPF, RG, CNH, endereço, data de nascimento, estado civil, foto nem dados de contato.',
  '- Mantenha os textos no idioma em que estão no currículo.',
].join('\n');

const INSTRUCTION = 'Extraia os dados deste currículo.';

/** Conteúdo da mensagem: o PDF vai como bloco `document`, antes do pedido. */
export function resumeUserContent(document: ResumeDocument): BetaContentBlockParam[] {
  if (document.kind === 'pdf') {
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: Buffer.from(document.data).toString('base64'),
        },
      },
      { type: 'text', text: INSTRUCTION },
    ];
  }
  return [{ type: 'text', text: `<curriculo>\n${document.text}\n</curriculo>\n\n${INSTRUCTION}` }];
}
