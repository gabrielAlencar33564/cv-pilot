import { describe, expect, it } from 'vitest';
import { renderCoverLetter } from './cover-letter';

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
