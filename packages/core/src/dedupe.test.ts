import { describe, expect, it } from 'vitest';
import { jobDedupeHash } from './dedupe';

const umaVaga = (o: Partial<{ company: string; title: string; location: string | null }> = {}) => ({
  company: 'Empresa X',
  title: 'Desenvolvedor Front-end',
  location: 'São Paulo',
  ...o,
});

describe('jobDedupeHash', () => {
  it('ignora acentos, caixa e pontuação', () => {
    const a = jobDedupeHash(umaVaga());
    const b = jobDedupeHash(
      umaVaga({ company: 'empresa x', title: 'DESENVOLVEDOR FRONT END', location: 'Sao Paulo' }),
    );
    expect(a).toBe(b);
  });

  it('separa vagas júnior e sênior da mesma empresa e cidade', () => {
    const junior = jobDedupeHash(umaVaga({ title: 'Dev Jr' }));
    const senior = jobDedupeHash(umaVaga({ title: 'Dev Sr' }));
    expect(junior).not.toBe(senior);
  });

  it('trata abreviação e nome completo da senioridade como a mesma vaga', () => {
    expect(jobDedupeHash(umaVaga({ title: 'Dev Jr.' }))).toBe(
      jobDedupeHash(umaVaga({ title: 'Dev Júnior' })),
    );
    expect(jobDedupeHash(umaVaga({ title: 'Dev Pl' }))).toBe(
      jobDedupeHash(umaVaga({ title: 'Dev Pleno' })),
    );
    expect(jobDedupeHash(umaVaga({ title: 'Dev Sr' }))).toBe(
      jobDedupeHash(umaVaga({ title: 'Dev Sênior' })),
    );
  });

  it('separa níveis numerados (Analista I e Analista II)', () => {
    expect(jobDedupeHash(umaVaga({ title: 'Analista I' }))).not.toBe(
      jobDedupeHash(umaVaga({ title: 'Analista II' })),
    );
  });

  it('separa a mesma vaga em empresas diferentes', () => {
    expect(jobDedupeHash(umaVaga())).not.toBe(jobDedupeHash(umaVaga({ company: 'Empresa Y' })));
  });

  it('trata local ausente como vazio', () => {
    expect(jobDedupeHash(umaVaga({ location: null }))).toBe(
      jobDedupeHash(umaVaga({ location: '' })),
    );
  });
});
