import { describe, expect, it } from 'vitest';
import { resolveSendRule } from './send-rules';

const rules = [
  { id: 'default', sourceId: null, searchProfileId: null },
  { id: 'gupy', sourceId: 'gupy', searchProfileId: null },
  { id: 'profileA', sourceId: null, searchProfileId: 'A' },
  { id: 'gupy+A', sourceId: 'gupy', searchProfileId: 'A' },
];

describe('resolveSendRule', () => {
  it('prefere perfil + site', () => {
    expect(resolveSendRule(rules, { sourceId: 'gupy', searchProfileId: 'A' })?.id).toBe('gupy+A');
  });
  it('cai para a regra do site', () => {
    expect(resolveSendRule(rules, { sourceId: 'gupy', searchProfileId: 'B' })?.id).toBe('gupy');
  });
  it('cai para a regra do perfil', () => {
    expect(resolveSendRule(rules, { sourceId: 'lever', searchProfileId: 'A' })?.id).toBe(
      'profileA',
    );
  });
  it('cai para o padrão', () => {
    expect(resolveSendRule(rules, { sourceId: 'lever' })?.id).toBe('default');
  });
  it('retorna undefined sem regras', () => {
    expect(resolveSendRule([], { sourceId: 'gupy' })).toBeUndefined();
  });
});
