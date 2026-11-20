import { describe, expect, it } from 'vitest';
import { errorMessage, fillSummary, questionsSummary } from './popup-text';

const campo = { label: 'E-mail', source: 'email' as const };

describe('questionsSummary', () => {
  it('fala das perguntas que foram para o banco de respostas', () => {
    expect(questionsSummary(1)).toMatch(/^Uma pergunta ficou sem resposta e foi/);
    expect(questionsSummary(3)).toMatch(/^3 perguntas ficaram sem resposta e foram/);
  });

  it('sem pergunta pendente, não diz nada', () => {
    expect(questionsSummary(0)).toBe('');
  });
});

describe('fillSummary', () => {
  it('diz o que foi feito e lembra que quem envia é o candidato', () => {
    expect(
      fillSummary({
        filled: [campo, campo],
        resumeAttached: true,
        requiredEmpty: 0,
        unanswered: [],
      }),
    ).toBe('Preenchi 2 campos e anexei o currículo. Confira tudo e envie no site.');
  });

  it('avisa os campos obrigatórios que ficaram vazios', () => {
    expect(
      fillSummary({ filled: [campo], resumeAttached: false, requiredEmpty: 1, unanswered: [] }),
    ).toBe('Preenchi 1 campo. Ainda há 1 campo obrigatório vazio. Confira tudo e envie no site.');
  });

  it('só o currículo', () => {
    expect(
      fillSummary({ filled: [], resumeAttached: true, requiredEmpty: 3, unanswered: [] }),
    ).toBe(
      'Anexei o currículo. Ainda há 3 campos obrigatórios vazios. Confira tudo e envie no site.',
    );
  });

  it('sem nada para preencher, explica o provável motivo', () => {
    expect(
      fillSummary({ filled: [], resumeAttached: false, requiredEmpty: 0, unanswered: [] }),
    ).toMatch(/Não achei campos/);
  });
});

describe('errorMessage', () => {
  it('traduz os códigos conhecidos e tem um texto para os demais', () => {
    expect(errorMessage('consent_required')).toMatch(/Aceite os termos/);
    expect(errorMessage('http_500')).toMatch(/Algo deu errado/);
  });
});
