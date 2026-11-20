import { describe, expect, it } from 'vitest';
import { JOB_REQUIREMENTS_SYSTEM_PROMPT, jobRequirementsUserText } from './job-requirements';

describe('jobRequirementsUserText', () => {
  it('delimita o título e a descrição da vaga, separados do pedido', () => {
    const texto = jobRequirementsUserText({ title: 'Dev React', description: 'Stack: React.' });

    expect(texto).toContain('<titulo>Dev React</titulo>');
    expect(texto).toContain('<descricao>\nStack: React.\n</descricao>');
  });

  it('corta uma descrição absurda de longa', () => {
    const texto = jobRequirementsUserText({ title: 'Dev', description: 'x'.repeat(50_000) });

    expect(texto.length).toBeLessThan(21_000);
  });
});

describe('JOB_REQUIREMENTS_SYSTEM_PROMPT', () => {
  it('proíbe inventar requisitos e deixa de fora o que não dá para conferir no currículo', () => {
    expect(JOB_REQUIREMENTS_SYSTEM_PROMPT).toContain('Não invente');
    expect(JOB_REQUIREMENTS_SYSTEM_PROMPT).toContain('competências comportamentais');
  });
});
