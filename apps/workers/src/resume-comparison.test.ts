import { getAiProvider } from '@cv-pilot/ai';
import type { ParsedResume } from '@cv-pilot/contracts';
import {
  comparisonResumeVersion,
  embeddingPresence,
  jobResumeSimilarity,
  saveJobEmbedding,
  saveResumeVersionEmbedding,
} from '@cv-pilot/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compareWithResume } from './resume-comparison';

vi.mock('@cv-pilot/db', () => ({
  comparisonResumeVersion: vi.fn(),
  embeddingPresence: vi.fn(),
  jobResumeSimilarity: vi.fn(),
  saveJobEmbedding: vi.fn(),
  saveResumeVersionEmbedding: vi.fn(),
}));
vi.mock('@cv-pilot/ai', () => ({ getAiProvider: vi.fn() }));

const embed = vi.fn();
const vaga = { id: 'vaga-1', title: 'Dev React', description: 'Stack: React e Node.js.' };
const curriculo: ParsedResume = {
  summary: 'Desenvolvedora front-end.',
  skills: ['React', 'Vue'],
  experiences: [],
  education: [],
  languages: [],
};
const vetor = (valor: number) => Array.from({ length: 1024 }, () => valor);

describe('compareWithResume', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAiProvider).mockReturnValue({
      parseResume: vi.fn(),
      embed,
      extractJobRequirements: vi.fn(),
      writeCoverLetter: vi.fn(),
    });
    vi.mocked(comparisonResumeVersion).mockResolvedValue({ id: 'versao-1', parsed: curriculo });
    vi.mocked(jobResumeSimilarity).mockResolvedValue(0.62);
  });

  it('gera numa chamada só os embeddings que faltam e devolve a semelhança e as habilidades', async () => {
    vi.mocked(embeddingPresence).mockResolvedValue({ job: false, resume: false });
    embed.mockResolvedValue({ vectors: [vetor(0.1), vetor(0.2)], usage: { totalTokens: 30 } });

    await expect(compareWithResume(vaga, 'usuario-1', 'cv-1')).resolves.toEqual({
      similarity: 0.62,
      sharedSkills: ['React'],
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.lastCall?.[1]).toBe('document');
    expect(saveJobEmbedding).toHaveBeenCalledWith('vaga-1', vetor(0.1));
    expect(saveResumeVersionEmbedding).toHaveBeenCalledWith('versao-1', vetor(0.2));
  });

  it('com os dois vetores prontos, não chama o provedor', async () => {
    vi.mocked(embeddingPresence).mockResolvedValue({ job: true, resume: true });

    await expect(compareWithResume(vaga, 'usuario-1', null)).resolves.toMatchObject({
      similarity: 0.62,
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it('com o provedor sem embeddings (noop), sai só com as habilidades em comum', async () => {
    vi.mocked(embeddingPresence).mockResolvedValue({ job: false, resume: true });
    embed.mockResolvedValue(null);

    await expect(compareWithResume(vaga, 'usuario-1', null)).resolves.toEqual({
      similarity: null,
      sharedSkills: ['React'],
    });
    expect(jobResumeSimilarity).not.toHaveBeenCalled();
  });

  it('se o provedor falha, o match segue sem a semelhança', async () => {
    vi.mocked(embeddingPresence).mockResolvedValue({ job: false, resume: true });
    embed.mockRejectedValue(new Error('Voyage respondeu HTTP 503'));

    await expect(compareWithResume(vaga, 'usuario-1', null)).resolves.toEqual({
      similarity: null,
      sharedSkills: ['React'],
    });
  });

  it('compara com o currículo escolhido para a regra do usuário', async () => {
    vi.mocked(embeddingPresence).mockResolvedValue({ job: true, resume: true });

    await compareWithResume(vaga, 'usuario-1', 'cv-1');
    expect(comparisonResumeVersion).toHaveBeenCalledWith('usuario-1', 'cv-1');
    expect(jobResumeSimilarity).toHaveBeenCalledWith('vaga-1', 'versao-1');
  });

  it('sem nenhum currículo lido, não há comparação', async () => {
    vi.mocked(comparisonResumeVersion).mockResolvedValue(null);

    await expect(compareWithResume(vaga, 'usuario-1', null)).resolves.toEqual({
      similarity: null,
      sharedSkills: [],
    });
    expect(embeddingPresence).not.toHaveBeenCalled();
  });
});
