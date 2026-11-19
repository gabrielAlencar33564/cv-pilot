import { readFileSync } from 'node:fs';
import { ResumeParseError, getAiProvider } from '@cv-pilot/ai';
import { RESUME_FILE_TYPES } from '@cv-pilot/core';
import type { QueuePayloads } from '@cv-pilot/queue';
import { loadResumeFile } from '@cv-pilot/storage';
import { UnrecoverableError, type Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resumeParseProcessor } from './resume-parse';

const db = vi.hoisted(() => ({
  resumeVersion: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/storage', () => ({ loadResumeFile: vi.fn() }));
vi.mock('@cv-pilot/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAiProvider: vi.fn(),
}));

// DOCX sintético (dados fictícios), gerado uma vez e versionado
const DOCX = readFileSync(new URL('./fixtures/curriculo-sintetico.docx', import.meta.url));
const PDF = Buffer.from('%PDF-1.7 currículo sintético');

const curriculo = {
  summary: null,
  skills: ['React'],
  experiences: [],
  education: [],
  languages: [],
};
const parseResume = vi.fn();

const umJob = (tentativasFalhas = 0) =>
  // em teste, o job do BullMQ é montado à mão
  ({
    data: { resumeVersionId: 'versao-1' },
    attemptsMade: tentativasFalhas,
    opts: { attempts: 4 },
  }) as Job<QueuePayloads['resume-parse']>;

const umaVersao = (mimeType: string, o: Record<string, unknown> = {}) => ({
  storageKey: 'resumes/u/r/1-x',
  mimeType,
  parseStatus: 'pending',
  ...o,
});

describe('resumeParseProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAiProvider).mockReturnValue({ parseResume });
    parseResume.mockResolvedValue({
      resume: curriculo,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  });

  it('manda o PDF inteiro ao provedor e grava o resultado', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.pdf.mimeType));
    vi.mocked(loadResumeFile).mockResolvedValue(PDF);

    await expect(resumeParseProcessor(umJob())).resolves.toEqual({ skills: 1 });
    expect(parseResume).toHaveBeenCalledWith({ kind: 'pdf', data: PDF });
    expect(db.resumeVersion.update.mock.lastCall?.[0]).toMatchObject({
      where: { id: 'versao-1' },
      data: { parsed: curriculo, parseStatus: 'parsed', parseError: null },
    });
  });

  it('converte o DOCX em texto antes de mandar', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.docx.mimeType));
    vi.mocked(loadResumeFile).mockResolvedValue(DOCX);

    await resumeParseProcessor(umJob());
    const enviado: unknown = parseResume.mock.lastCall?.[0];
    expect(enviado).toMatchObject({ kind: 'text' });
    expect((enviado as { text: string }).text).toContain('Desenvolvedora Front-end');
  });

  it('não reprocessa uma versão já extraída', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(
      umaVersao(RESUME_FILE_TYPES.pdf.mimeType, { parseStatus: 'parsed' }),
    );

    await expect(resumeParseProcessor(umJob())).resolves.toEqual({ skipped: 'already_parsed' });
    expect(parseResume).not.toHaveBeenCalled();
  });

  it('ignora versão que não existe mais', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(null);

    await expect(resumeParseProcessor(umJob())).resolves.toEqual({ skipped: 'not_found' });
  });

  it('falha definitiva marca failed com o código e não repete', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.pdf.mimeType));
    vi.mocked(loadResumeFile).mockResolvedValue(PDF);
    parseResume.mockRejectedValue(new ResumeParseError('refusal'));

    await expect(resumeParseProcessor(umJob())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(db.resumeVersion.update).toHaveBeenCalledWith({
      where: { id: 'versao-1' },
      data: { parseStatus: 'failed', parseError: 'refusal' },
    });
  });

  it('DOCX ilegível vira unreadable_file', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.docx.mimeType));
    vi.mocked(loadResumeFile).mockResolvedValue(Buffer.from('PK\u0003\u0004 corrompido'));

    await expect(resumeParseProcessor(umJob())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(db.resumeVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { parseStatus: 'failed', parseError: 'unreadable_file' } }),
    );
    expect(parseResume).not.toHaveBeenCalled();
  });

  it('erro temporário repete sem marcar a versão', async () => {
    const instavel = new Error('storage fora do ar');
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.pdf.mimeType));
    vi.mocked(loadResumeFile).mockRejectedValue(instavel);

    await expect(resumeParseProcessor(umJob(0))).rejects.toBe(instavel);
    expect(db.resumeVersion.update).not.toHaveBeenCalled();
  });

  it('na última tentativa, o erro temporário marca failed (retries_exhausted)', async () => {
    db.resumeVersion.findUnique.mockResolvedValue(umaVersao(RESUME_FILE_TYPES.pdf.mimeType));
    vi.mocked(loadResumeFile).mockRejectedValue(new Error('storage fora do ar'));

    await expect(resumeParseProcessor(umJob(3))).rejects.toThrow('storage fora do ar');
    expect(db.resumeVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { parseStatus: 'failed', parseError: 'retries_exhausted' } }),
    );
  });
});
