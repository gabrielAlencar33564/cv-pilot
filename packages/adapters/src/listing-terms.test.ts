import { describe, expect, it } from 'vitest';
import { classifyListingTerms } from './listing-terms';

describe('classifyListingTerms', () => {
  it('lê contrato, nível e modelo do resumo do card', () => {
    expect(classifyListingTerms(['PJ', 'Junior', 'Híbrido'])).toEqual({
      contractType: 'pj',
      seniority: 'junior',
      workModel: 'hybrid',
    });
  });

  it('entende acentos, caixa e "Home Office"', () => {
    expect(classifyListingTerms(['clt', 'Sênior', 'Home Office'])).toEqual({
      contractType: 'clt',
      seniority: 'senior',
      workModel: 'remote',
    });
  });

  it('com dois contratos possíveis, não escolhe nenhum', () => {
    expect(classifyListingTerms(['CLT, PJ', 'Pleno']).contractType).toBeNull();
    expect(classifyListingTerms(['CLT, PJ', 'Pleno']).seniority).toBe('mid');
  });

  it('ignora o que não conhece, como o porte da empresa', () => {
    expect(classifyListingTerms(['Pequena/média empresa', 'Remoto'])).toEqual({
      contractType: null,
      seniority: null,
      workModel: 'remote',
    });
  });
});
