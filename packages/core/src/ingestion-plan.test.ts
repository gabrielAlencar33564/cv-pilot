import { describe, expect, it } from 'vitest';
import { planIngestion } from './ingestion-plan';

const gupy = { id: 'gupy', fetchBy: 'keyword' as const, careerBoardIds: [] };
const greenhouse = {
  id: 'greenhouse',
  fetchBy: 'board' as const,
  careerBoardIds: ['cb-1', 'cb-2'],
};

describe('planIngestion', () => {
  it('a mesma palavra-chave pedida por vários perfis vira uma consulta só', () => {
    const plano = planIngestion(
      [
        { sourceIds: ['gupy'], keywords: ['React', 'node.js'] },
        { sourceIds: ['gupy'], keywords: [' react  ', 'React Native'] },
      ],
      [gupy],
    );

    expect(plano).toEqual([
      { sourceId: 'gupy', keyword: 'react' },
      { sourceId: 'gupy', keyword: 'node.js' },
      { sourceId: 'gupy', keyword: 'react native' },
    ]);
  });

  it('fonte por empresa baixa cada board ativo uma vez, por mais perfis que a usem', () => {
    const plano = planIngestion(
      [
        { sourceIds: ['greenhouse'], keywords: ['react'] },
        { sourceIds: ['greenhouse', 'gupy'], keywords: ['java'] },
      ],
      [gupy, greenhouse],
    );

    expect(plano).toEqual([
      { sourceId: 'greenhouse', careerBoardId: 'cb-1' },
      { sourceId: 'greenhouse', careerBoardId: 'cb-2' },
      { sourceId: 'gupy', keyword: 'java' },
    ]);
  });

  it('ignora fontes inativas ou desconhecidas e palavras-chave vazias', () => {
    const plano = planIngestion([{ sourceIds: ['linkedin', 'gupy'], keywords: ['  '] }], [gupy]);

    expect(plano).toEqual([]);
  });
});
