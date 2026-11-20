import { Prisma } from '@cv-pilot/db';
import {
  enqueueApplication,
  enqueueCoverLetter,
  releaseDailySlot,
  reserveDailySlot,
  type QueuePayloads,
} from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueJobRequirements } from '../requirements-queue';
import { compareWithResume } from '../resume-comparison';
import { matchProcessor } from './match';

const db = vi.hoisted(() => ({
  job: { findUnique: vi.fn() },
  searchProfile: { findUnique: vi.fn() },
  jobMatch: { upsert: vi.fn() },
  sendRule: { findMany: vi.fn() },
  resumeVersion: { findFirst: vi.fn() },
  application: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock('@cv-pilot/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  prisma: db,
}));
vi.mock('../resume-comparison', () => ({ compareWithResume: vi.fn() }));
vi.mock('../requirements-queue', () => ({ enqueueJobRequirements: vi.fn() }));
vi.mock('@cv-pilot/queue', () => ({
  enqueueApplication: vi.fn(),
  enqueueCoverLetter: vi.fn(),
  getRedis: vi.fn(),
  reserveDailySlot: vi.fn(),
  releaseDailySlot: vi.fn(),
}));

const vaga = {
  id: 'vaga-1',
  title: 'Dev React',
  company: 'Empresa X',
  description: 'react',
  workModel: 'remote',
  location: null,
  seniority: null,
  contractType: null,
  salaryMin: null,
  salaryMax: null,
  active: true,
  requirements: null,
  sources: [{ sourceId: 'gupy' }],
};

const perfil = (o: Record<string, unknown> = {}) => ({
  id: 'perfil-1',
  userId: 'usuario-1',
  keywords: ['react'],
  excludeKeywords: [],
  workModels: [],
  seniorities: [],
  contractTypes: [],
  companyBlacklist: [],
  salaryMin: null,
  salaryMax: null,
  location: null,
  sourceIds: ['gupy'],
  minScoreAutoApply: 50,
  dailyApplyLimit: 5,
  active: true,
  user: { timezone: 'America/Sao_Paulo', name: 'Ana Souza' },
  ...o,
});

const regra = (o: Record<string, unknown> = {}) => ({
  id: 'regra-1',
  userId: 'usuario-1',
  sourceId: 'gupy',
  searchProfileId: null,
  resumeId: 'cv-1',
  reviewBeforeSend: false,
  mode: 'assisted',
  defaultAnswers: {},
  generateCoverLetter: false,
  coverLetterTemplate: null,
  ...o,
});

// em teste, o job do BullMQ é montado à mão
const umJob = { data: { jobId: 'vaga-1', searchProfileId: 'perfil-1' } } as Job<
  QueuePayloads['match']
>;

describe('matchProcessor: limite diário', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 23:30 do dia 18 em São Paulo, já dia 19 em UTC
    vi.useFakeTimers({ now: new Date('2026-11-19T02:30:00Z') });
    db.job.findUnique.mockResolvedValue(vaga);
    db.searchProfile.findUnique.mockResolvedValue(perfil());
    db.sendRule.findMany.mockResolvedValue([regra()]);
    // estes testes olham o limite diário: sem currículo para comparar, a nota é a das regras
    vi.mocked(compareWithResume).mockResolvedValue({ similarity: null, sharedSkills: [] });
    db.resumeVersion.findFirst.mockResolvedValue({ id: 'versao-1' });
    db.application.findUnique.mockResolvedValue(null);
    db.application.create.mockImplementation(
      ({ data }: { data: { status: string; coverLetterStatus: string | null } }) => ({
        id: 'candidatura-1',
        status: data.status,
        coverLetterStatus: data.coverLetterStatus,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('com vaga no limite, enfileira o envio automático', async () => {
    vi.mocked(reserveDailySlot).mockResolvedValue(true);

    await expect(matchProcessor(umJob)).resolves.toMatchObject({ status: 'queued' });
    expect(vi.mocked(enqueueApplication)).toHaveBeenCalledWith('candidatura-1');
  });

  it('a candidatura leva o modelo de carta da regra preenchido', async () => {
    db.sendRule.findMany.mockResolvedValue([
      regra({ coverLetterTemplate: { body: 'Sou {{nome}}, quero ser {{cargo}} na {{empresa}}.' } }),
    ]);
    await matchProcessor(umJob);

    expect(db.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverLetter: 'Sou Ana Souza, quero ser Dev React na Empresa X.',
        }) as unknown,
      }),
    );
  });

  it('sem modelo na regra, a candidatura vai sem carta', async () => {
    await matchProcessor(umJob);

    expect(db.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coverLetter: null, coverLetterStatus: null }) as unknown,
      }),
    );
    expect(vi.mocked(enqueueCoverLetter)).not.toHaveBeenCalled();
  });

  it('com a IA ligada na regra, a candidatura nasce gerando a carta e pede a escrita', async () => {
    db.sendRule.findMany.mockResolvedValue([
      regra({ generateCoverLetter: true, coverLetterTemplate: { body: 'Modelo de {{nome}}' } }),
    ]);
    vi.mocked(reserveDailySlot).mockResolvedValue(true);
    await matchProcessor(umJob);

    expect(db.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverLetter: 'Modelo de Ana Souza',
          coverLetterStatus: 'generating',
        }) as unknown,
      }),
    );
    expect(vi.mocked(enqueueCoverLetter)).toHaveBeenCalledWith('candidatura-1');
    expect(vi.mocked(enqueueApplication)).toHaveBeenCalledWith('candidatura-1');
  });

  it('reserva por usuário, fonte e dia no fuso do usuário, com o limite do perfil', async () => {
    vi.mocked(reserveDailySlot).mockResolvedValue(true);
    await matchProcessor(umJob);

    expect(vi.mocked(reserveDailySlot).mock.lastCall?.slice(1)).toEqual([
      { userId: 'usuario-1', sourceId: 'gupy', day: '2026-11-18' },
      5,
    ]);
  });

  it('com o limite atingido, a candidatura fica sugerida e nada é enfileirado', async () => {
    vi.mocked(reserveDailySlot).mockResolvedValue(false);

    await expect(matchProcessor(umJob)).resolves.toMatchObject({ status: 'suggested' });
    expect(vi.mocked(enqueueApplication)).not.toHaveBeenCalled();
  });

  it('com revisão antes do envio, não gasta o limite', async () => {
    db.sendRule.findMany.mockResolvedValue([regra({ reviewBeforeSend: true })]);

    await expect(matchProcessor(umJob)).resolves.toMatchObject({ status: 'suggested' });
    expect(vi.mocked(reserveDailySlot)).not.toHaveBeenCalled();
  });

  it('candidatura que já existe não reserva vaga de novo', async () => {
    db.application.findUnique.mockResolvedValue({ id: 'candidatura-0', status: 'needs_action' });

    await expect(matchProcessor(umJob)).resolves.toMatchObject({ applicationId: 'candidatura-0' });
    expect(vi.mocked(reserveDailySlot)).not.toHaveBeenCalled();
    expect(db.application.create).not.toHaveBeenCalled();
  });

  it('devolve a vaga se outro match criou a mesma candidatura antes', async () => {
    vi.mocked(reserveDailySlot).mockResolvedValue(true);
    db.application.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicada', {
        code: 'P2002',
        clientVersion: 'teste',
      }),
    );

    await expect(matchProcessor(umJob)).resolves.toMatchObject({ note: 'candidatura já existe' });
    expect(vi.mocked(releaseDailySlot)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueApplication)).not.toHaveBeenCalled();
  });
});

describe('matchProcessor: vaga ou perfil fora do ar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('vaga que fechou depois da ingestão não gera match', async () => {
    db.job.findUnique.mockResolvedValue({ ...vaga, active: false });
    db.searchProfile.findUnique.mockResolvedValue(perfil());

    await expect(matchProcessor(umJob)).resolves.toEqual({ skipped: true });
    expect(db.jobMatch.upsert).not.toHaveBeenCalled();
  });

  it('perfil pausado depois da ingestão não gera match', async () => {
    db.job.findUnique.mockResolvedValue(vaga);
    db.searchProfile.findUnique.mockResolvedValue(perfil({ active: false }));

    await expect(matchProcessor(umJob)).resolves.toEqual({ skipped: true });
    expect(db.jobMatch.upsert).not.toHaveBeenCalled();
  });
});

describe('matchProcessor: semelhança com o currículo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.job.findUnique.mockResolvedValue(vaga);
    // nota mínima alta: o teste olha só a nota gravada, sem criar candidatura
    db.searchProfile.findUnique.mockResolvedValue(perfil({ minScoreAutoApply: 101 }));
    db.sendRule.findMany.mockResolvedValue([regra({ resumeId: 'cv-da-regra' })]);
  });

  it('compara com o currículo da regra do site e grava a nota combinada com os motivos', async () => {
    vi.mocked(compareWithResume).mockResolvedValue({ similarity: 0.8, sharedSkills: ['React'] });

    await matchProcessor(umJob);
    expect(compareWithResume).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vaga-1' }),
      'usuario-1',
      'cv-da-regra',
    );
    const gravado = db.jobMatch.upsert.mock.lastCall?.[0] as {
      create: { score: number; reasons: string[] };
    };
    // regras 100 (palavra-chave no título e no texto) × 60% + semelhança 100 × 40%
    expect(gravado.create.score).toBe(100);
    expect(gravado.create.reasons).toEqual(
      expect.arrayContaining([
        'Habilidades do currículo na vaga: React',
        'Semelhança com o currículo: 100%',
      ]) as unknown,
    );
  });

  it('sem semelhança, grava a nota das regras', async () => {
    vi.mocked(compareWithResume).mockResolvedValue({ similarity: null, sharedSkills: [] });

    await matchProcessor(umJob);
    expect(db.jobMatch.upsert.mock.lastCall?.[0]).toMatchObject({ create: { score: 100 } });
  });
});

describe('matchProcessor: requisitos da vaga (RF-41)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.job.findUnique.mockResolvedValue(vaga);
    db.sendRule.findMany.mockResolvedValue([]);
    vi.mocked(compareWithResume).mockResolvedValue({ similarity: null, sharedSkills: [] });
  });

  it('vaga acima da nota mínima e sem requisitos pede a extração', async () => {
    db.searchProfile.findUnique.mockResolvedValue(perfil({ minScoreAutoApply: 50 }));

    await matchProcessor(umJob);
    expect(enqueueJobRequirements).toHaveBeenCalledWith(expect.objectContaining({ id: 'vaga-1' }));
  });

  it('vaga abaixo da nota mínima não gasta uma extração', async () => {
    db.searchProfile.findUnique.mockResolvedValue(perfil({ minScoreAutoApply: 101 }));

    await matchProcessor(umJob);
    expect(enqueueJobRequirements).not.toHaveBeenCalled();
  });

  it('vaga com os requisitos já extraídos não pede de novo', async () => {
    db.job.findUnique.mockResolvedValue({ ...vaga, requirements: { requirements: [] } });
    db.searchProfile.findUnique.mockResolvedValue(perfil({ minScoreAutoApply: 50 }));

    await matchProcessor(umJob);
    expect(enqueueJobRequirements).not.toHaveBeenCalled();
  });
});
