import { describe, expect, it } from 'vitest';
import { questionKey } from './saved-answers';

describe('questionKey', () => {
  it('a mesma pergunta com acento, pontuação e maiúscula diferentes dá a mesma chave', () => {
    const chaves = [
      'Por que você quer trabalhar aqui?',
      'POR QUE VOCE QUER TRABALHAR AQUI',
      '  Por que você quer   trabalhar aqui? * ',
      'Por que você quer trabalhar aqui? (obrigatório)',
    ].map(questionKey);

    expect(new Set(chaves)).toEqual(new Set(['por que voce quer trabalhar aqui']));
  });

  it('perguntas diferentes continuam diferentes', () => {
    expect(questionKey('Possui CNH?')).not.toBe(questionKey('Possui carro?'));
  });

  it('mantém números, que mudam a pergunta', () => {
    expect(questionKey('Experiência com React (anos)?')).toBe('experiencia com react anos');
    expect(questionKey('Inglês nível 2+')).toBe('ingles nivel 2');
  });
});
