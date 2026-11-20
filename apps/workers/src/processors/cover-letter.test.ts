import { CoverLetterError, getAiProvider } from '@cv-pilot/ai';
import type { QueuePayloads } from '@cv-pilot/queue';
import { UnrecoverableError, type Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { coverLetterProcessor } from './cover-letter';

const db = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), updateMany: vi.fn() },
  sendRule: { findUnique: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAiProvider: vi.fn(),
}));

const writeCoverLetter = vi.fn();
const curriculo = {
  summary: null,
  skills: ['React'],
  experiences: [],
  education: [],
  languages: [],
};
const candidatura = (o: Record<string, unknown> = {}) => ({
  status: 'suggested',
  coverLetterStatus: 'generating',
  sendRuleId: 'regra-1',
  job: { title: 'Dev React', company: 'Acme', description: 'Exigimos React.' },
  resumeVersion: { parseStatus: 'parsed', parsed: curriculo },
  user: { name: 'Ana Souza' },
  ...o,
});
// em teste, o job do BullMQ é montado à mão
const umJob = (attemptsMade = 0) =>
  ({ data: { applicationId: 'candidatura-1' }, attemptsMade, opts: { attempts: 4 } }) as Job<
    QueuePayloads['cover-letter']
  >;
const gravouStatus = (coverLetterStatus: string | null) =>
  expect(db.application.updateMany).toHaveBeenCalledWith({
    where: { id: 'candidatura-1', coverLetterStatus: 'generating' },
    data: expect.objectContaining({ coverLetterStatus }) as unknown,
  });

describe('coverLetterProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAiProvider).mockReturnValue({
      parseResume: vi.fn(),
      embed: vi.fn(),
      extractJobRequirements: vi.fn(),
      writeCoverLetter,
    });
    db.application.findUnique.mockResolvedValue(candidatura());
    db.application.updateMany.mockResolvedValue({ count: 1 });
    db.sendRule.findUnique.mockResolvedValue({ tone: 'formal' });
    writeCoverLetter.mockResolvedValue({
      body: 'Prezada equipe da Acme,\n\nAtenciosamente,\n{{nome}}',
      usage: { inputTokens: 900, outputTokens: 250 },
    });
  });

  it('manda a vaga, o currículo e o tom da regra, sem o nome, e grava a carta assinada', async () => {
    await expect(coverLetterProcessor(umJob())).resolves.toEqual({ saved: true });

    expect(writeCoverLetter).toHaveBeenCalledWith({
      job: { title: 'Dev React', company: 'Acme', description: 'Exigimos React.' },
      resume: curriculo,
      tone: 'formal',
    });
    expect(JSON.stringify(writeCoverLetter.mock.calls)).not.toContain('Ana Souza');
    expect(db.application.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidatura-1', coverLetterStatus: 'generating' },
      data: {
        coverLetter: 'Prezada equipe da Acme,\n\nAtenciosamente,\nAna Souza',
        coverLetterStatus: 'generated',
      },
    });
  });

  it('carta editada pelo candidato durante a escrita não é sobrescrita', async () => {
    db.application.updateMany.mockResolvedValue({ count: 0 });

    await expect(coverLetterProcessor(umJob())).resolves.toEqual({ saved: false });
  });

  it('a segunda execução do mesmo job não chama a IA de novo', async () => {
    db.application.findUnique.mockResolvedValue(candidatura({ coverLetterStatus: 'generated' }));

    await expect(coverLetterProcessor(umJob())).resolves.toEqual({ skipped: 'not_generating' });
    expect(writeCoverLetter).not.toHaveBeenCalled();
  });

  it('candidatura removida ou já enviada não gasta uma carta', async () => {
    db.application.findUnique.mockResolvedValueOnce(null);
    await expect(coverLetterProcessor(umJob())).resolves.toEqual({ skipped: 'not_found' });

    db.application.findUnique.mockResolvedValueOnce(candidatura({ status: 'sent' }));
    await expect(coverLetterProcessor(umJob())).resolves.toEqual({ skipped: 'already_sent' });
    expect(writeCoverLetter).not.toHaveBeenCalled();
  });

  it('regra apagada usa o tom padrão (técnico)', async () => {
    db.application.findUnique.mockResolvedValue(candidatura({ sendRuleId: null }));
    await coverLetterProcessor(umJob());

    expect(writeCoverLetter).toHaveBeenCalledWith(expect.objectContaining({ tone: 'technical' }));
  });

  it('currículo ainda em leitura: tenta de novo e só marca falha na última tentativa', async () => {
    db.application.findUnique.mockResolvedValue(
      candidatura({ resumeVersion: { parseStatus: 'pending', parsed: null } }),
    );

    await expect(coverLetterProcessor(umJob(0))).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(db.application.updateMany).not.toHaveBeenCalled();

    await expect(coverLetterProcessor(umJob(3))).rejects.toThrow('ainda está sendo lido');
    gravouStatus('failed');
  });

  it('currículo que não foi lido marca a carta como falha e não repete', async () => {
    db.application.findUnique.mockResolvedValue(
      candidatura({ resumeVersion: { parseStatus: 'failed', parsed: null } }),
    );

    await expect(coverLetterProcessor(umJob())).rejects.toBeInstanceOf(UnrecoverableError);
    gravouStatus('failed');
    expect(writeCoverLetter).not.toHaveBeenCalled();
  });

  it('recusa da IA marca a carta como falha e não repete', async () => {
    writeCoverLetter.mockRejectedValue(new CoverLetterError('refusal'));

    await expect(coverLetterProcessor(umJob())).rejects.toBeInstanceOf(UnrecoverableError);
    gravouStatus('failed');
  });

  it('erro temporário sobe para o BullMQ repetir e só marca falha na última tentativa', async () => {
    const erro = new Error('HTTP 529');
    writeCoverLetter.mockRejectedValue(erro);

    await expect(coverLetterProcessor(umJob(0))).rejects.toBe(erro);
    expect(db.application.updateMany).not.toHaveBeenCalled();

    await expect(coverLetterProcessor(umJob(3))).rejects.toBe(erro);
    gravouStatus('failed');
  });

  it('com o provedor sem cartas (noop), fica o modelo da regra, como sem IA', async () => {
    writeCoverLetter.mockResolvedValue(null);

    await expect(coverLetterProcessor(umJob())).resolves.toEqual({
      skipped: 'provider_without_cover_letter',
    });
    expect(db.application.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidatura-1', coverLetterStatus: 'generating' },
      data: { coverLetterStatus: null },
    });
  });
});
