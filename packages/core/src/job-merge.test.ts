import { describe, expect, it } from 'vitest';
import { mergeJob, type JobContent } from './job-merge';

const umaVaga = (o: Partial<JobContent> = {}): JobContent => ({
  title: 'Desenvolvedor React',
  company: 'Empresa X',
  location: 'São Paulo',
  workModel: 'hybrid',
  seniority: null,
  contractType: 'clt',
  salaryMin: null,
  salaryMax: null,
  description: 'Descrição completa da vaga, com requisitos e benefícios.',
  applyEmail: null,
  publishedAt: new Date('2026-11-01T10:00:00Z'),
  ...o,
});

describe('mergeJob', () => {
  it('vaga nova entra como veio e conta como mudança', () => {
    const { job, changed } = mergeJob(null, { ...umaVaga(), location: undefined });

    expect(changed).toBe(true);
    expect(job.location).toBeNull();
  });

  it('campo vazio na fonte nova não apaga o que outra fonte informou', () => {
    const { job } = mergeJob(umaVaga(), { ...umaVaga(), contractType: null, workModel: undefined });

    expect(job).toMatchObject({ contractType: 'clt', workModel: 'hybrid' });
  });

  it('mantém a descrição mais completa', () => {
    const { job } = mergeJob(umaVaga(), umaVaga({ description: 'Curta.' }));

    expect(job.description).toBe(umaVaga().description);
  });

  it('a fonte nova pode preencher e corrigir campos', () => {
    const { job, changed } = mergeJob(umaVaga(), umaVaga({ salaryMin: 8000, workModel: 'remote' }));

    expect(changed).toBe(true);
    expect(job).toMatchObject({ salaryMin: 8000, workModel: 'remote' });
  });

  it('a mesma vaga de novo não conta como mudança, nem com datas em outro objeto', () => {
    const repetida = umaVaga({ publishedAt: new Date('2026-11-01T10:00:00Z') });

    expect(mergeJob(umaVaga(), repetida).changed).toBe(false);
  });

  it('só uma descrição mais curta também não conta como mudança', () => {
    expect(mergeJob(umaVaga(), umaVaga({ description: 'Curta.' })).changed).toBe(false);
  });
});
