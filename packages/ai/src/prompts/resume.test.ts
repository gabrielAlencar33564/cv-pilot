import { describe, expect, it } from 'vitest';
import { RESUME_SYSTEM_PROMPT, resumeUserContent } from './resume';

describe('resumeUserContent', () => {
  it('manda o PDF em base64 como bloco document, antes do pedido', () => {
    const pdf = Buffer.from('%PDF-1.7 currículo');
    const [documento, pedido] = resumeUserContent({ kind: 'pdf', data: new Uint8Array(pdf) });

    expect(documento).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') },
    });
    expect(pedido).toMatchObject({ type: 'text' });
  });

  it('delimita o texto do DOCX para separá-lo do pedido', () => {
    const [bloco] = resumeUserContent({ kind: 'text', text: 'Maria\nDesenvolvedora' });

    expect(bloco).toMatchObject({ type: 'text' });
    expect(bloco?.type === 'text' && bloco.text).toContain(
      '<curriculo>\nMaria\nDesenvolvedora\n</curriculo>',
    );
  });
});

describe('RESUME_SYSTEM_PROMPT', () => {
  it('proíbe inventar dados e pede para ignorar documentos pessoais', () => {
    expect(RESUME_SYSTEM_PROMPT).toContain('Não invente');
    expect(RESUME_SYSTEM_PROMPT).toContain('CPF');
  });
});
