import { describe, expect, it } from 'vitest';
import { canEditCoverLetter, initialCoverLetter, renderCoverLetter } from './cover-letter';

const values = { empresa: 'Acme', cargo: 'Dev Front-end', nome: 'Ana Souza' };

describe('renderCoverLetter', () => {
  it('troca as variáveis pelos dados da vaga e do candidato', () => {
    expect(renderCoverLetter('Olá, {{empresa}}! Sou {{nome}} e quero ser {{cargo}}.', values)).toBe(
      'Olá, Acme! Sou Ana Souza e quero ser Dev Front-end.',
    );
  });

  it('aceita espaços e maiúsculas dentro das chaves', () => {
    expect(renderCoverLetter('{{ Empresa }} / {{CARGO}}', values)).toBe('Acme / Dev Front-end');
  });

  it('troca todas as ocorrências da mesma variável', () => {
    expect(renderCoverLetter('{{empresa}} e {{empresa}}', values)).toBe('Acme e Acme');
  });

  it('mantém chaves que não são variáveis conhecidas', () => {
    expect(renderCoverLetter('Prezado {{recrutador}}', values)).toBe('Prezado {{recrutador}}');
  });

  it('não interpreta caracteres especiais dos dados como padrão de substituição', () => {
    expect(renderCoverLetter('{{empresa}}', { ...values, empresa: 'R$ & $1 Ltda' })).toBe(
      'R$ & $1 Ltda',
    );
  });
});

describe('initialCoverLetter', () => {
  const modelo = { body: 'Olá, {{empresa}}. {{nome}}' };

  it('sem IA, vai o modelo preenchido e nenhum status', () => {
    expect(
      initialCoverLetter({ generateCoverLetter: false, coverLetterTemplate: modelo }, values),
    ).toEqual({ coverLetter: 'Olá, Acme. Ana Souza', coverLetterStatus: null });
  });

  it('sem IA e sem modelo, a candidatura vai sem carta', () => {
    expect(
      initialCoverLetter({ generateCoverLetter: false, coverLetterTemplate: null }, values),
    ).toEqual({ coverLetter: null, coverLetterStatus: null });
  });

  it('com IA, começa gerando e guarda o modelo como reserva', () => {
    expect(
      initialCoverLetter({ generateCoverLetter: true, coverLetterTemplate: modelo }, values),
    ).toEqual({ coverLetter: 'Olá, Acme. Ana Souza', coverLetterStatus: 'generating' });
  });

  it('com IA e sem modelo, começa gerando e sem carta', () => {
    expect(
      initialCoverLetter({ generateCoverLetter: true, coverLetterTemplate: null }, values),
    ).toEqual({ coverLetter: null, coverLetterStatus: 'generating' });
  });
});

describe('canEditCoverLetter', () => {
  it.each(['suggested', 'queued', 'needs_action'] as const)('%s ainda aceita edição', (status) => {
    expect(canEditCoverLetter(status)).toBe(true);
  });

  it.each([
    'sent',
    'in_process',
    'interview',
    'offer',
    'rejected',
    'no_response',
    'failed',
  ] as const)('%s já não muda a carta', (status) => {
    expect(canEditCoverLetter(status)).toBe(false);
  });
});
