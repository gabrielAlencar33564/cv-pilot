import { describe, expect, it } from 'vitest';
import { followUpMessage, followUpSentCutoff, followUpState } from './follow-up';

const agora = new Date('2026-11-20T12:00:00Z');
const diasAtras = (dias: number) => new Date(agora.getTime() - dias * 24 * 3600_000);

describe('followUpState', () => {
  it('enviada há uma semana sem resposta pede follow-up', () => {
    expect(followUpState({ status: 'sent', sentAt: diasAtras(7), followedUpAt: null }, agora)).toBe(
      'due',
    );
  });

  it('antes de uma semana ainda espera', () => {
    expect(
      followUpState({ status: 'sent', sentAt: diasAtras(6), followedUpAt: null }, agora),
    ).toBeNull();
  });

  it('depois do follow-up, espera mais uma semana antes de sugerir "Sem resposta"', () => {
    const enviada = { status: 'sent', sentAt: diasAtras(20) };

    expect(followUpState({ ...enviada, followedUpAt: diasAtras(3) }, agora)).toBeNull();
    expect(followUpState({ ...enviada, followedUpAt: diasAtras(7) }, agora)).toBe('stale');
  });

  it('qualquer retorno da empresa tira a candidatura do follow-up', () => {
    for (const status of ['in_process', 'interview', 'rejected', 'no_response', 'needs_action']) {
      expect(
        followUpState({ status, sentAt: diasAtras(30), followedUpAt: null }, agora),
      ).toBeNull();
    }
  });

  it('enviada sem data não tem como contar o prazo', () => {
    expect(followUpState({ status: 'sent', sentAt: null, followedUpAt: null }, agora)).toBeNull();
  });
});

describe('followUpSentCutoff', () => {
  it('é o instante de uma semana atrás', () => {
    expect(followUpSentCutoff(agora)).toEqual(diasAtras(7));
  });
});

describe('followUpMessage', () => {
  it('cita a vaga e a empresa e assina com o nome', () => {
    const mensagem = followUpMessage({ cargo: 'Dev React', empresa: 'Acme', nome: 'Ana Souza' });

    expect(mensagem).toContain('vaga de Dev React na Acme');
    expect(mensagem.endsWith('Agradeço a atenção!\nAna Souza')).toBe(true);
  });

  it('sem nome no cadastro, termina no agradecimento', () => {
    expect(followUpMessage({ cargo: 'Dev', empresa: 'Acme', nome: '' })).toMatch(
      /Agradeço a atenção!$/,
    );
  });
});
