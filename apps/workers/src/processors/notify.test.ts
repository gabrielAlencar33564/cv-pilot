import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyProcessor } from './notify';

const db = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), count: vi.fn() },
  resumeVersion: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  jobMatch: { count: vi.fn() },
  notification: { findFirst: vi.fn(), upsert: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));

// em teste, o job do BullMQ é montado à mão
const umJob = (data: QueuePayloads['notify']) => ({ data }) as Job<QueuePayloads['notify']>;

describe('notifyProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-11-19T11:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ação necessária', () => {
    const job = umJob({ kind: 'needs_action', applicationId: 'cand-1' });

    it('grava o alerta para o dono da candidatura, só com o id', async () => {
      db.application.findUnique.mockResolvedValue({ userId: 'usuario-1', status: 'needs_action' });

      await expect(notifyProcessor(job)).resolves.toEqual({ notified: 'needs_action' });
      expect(db.notification.upsert).toHaveBeenCalledWith({
        where: { userId_dedupeKey: { userId: 'usuario-1', dedupeKey: 'needs_action_cand-1' } },
        create: {
          userId: 'usuario-1',
          dedupeKey: 'needs_action_cand-1',
          kind: 'needs_action',
          data: { applicationId: 'cand-1' },
        },
        // rodar de novo não mexe no alerta que já existe (nem o marca como não lido)
        update: {},
      });
    });

    it('não avisa se o candidato já resolveu a candidatura', async () => {
      db.application.findUnique.mockResolvedValue({ userId: 'usuario-1', status: 'sent' });

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true });
      expect(db.notification.upsert).not.toHaveBeenCalled();
    });

    it('ignora candidatura que não existe mais', async () => {
      db.application.findUnique.mockResolvedValue(null);

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true });
    });
  });

  describe('falha na leitura do currículo', () => {
    const job = umJob({ kind: 'resume_parse_failed', resumeVersionId: 'versao-1' });

    it('grava o alerta com o currículo e a versão', async () => {
      db.resumeVersion.findUnique.mockResolvedValue({
        parseStatus: 'failed',
        resumeId: 'cv-1',
        resume: { userId: 'usuario-1' },
      });

      await notifyProcessor(job);
      expect(db.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            kind: 'resume_parse_failed',
            data: { resumeId: 'cv-1', resumeVersionId: 'versao-1' },
          }) as unknown,
        }),
      );
    });

    it('não avisa se a versão foi lida depois (novo envio do mesmo arquivo)', async () => {
      db.resumeVersion.findUnique.mockResolvedValue({
        parseStatus: 'parsed',
        resumeId: 'cv-1',
        resume: { userId: 'usuario-1' },
      });

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true });
    });
  });

  describe('resumo diário de vagas novas', () => {
    const job = umJob({ kind: 'new_jobs', userId: 'usuario-1', day: '2026-11-19' });

    beforeEach(() => {
      db.user.findUnique.mockResolvedValue({ deletedAt: null });
    });

    it('conta as vagas desde o resumo anterior', async () => {
      const anterior = new Date('2026-11-18T11:00:00Z');
      db.notification.findFirst.mockResolvedValue({ createdAt: anterior });
      db.jobMatch.count.mockResolvedValue(3);

      await notifyProcessor(job);
      expect(db.jobMatch.count).toHaveBeenCalledWith({
        where: {
          searchProfile: { userId: 'usuario-1' },
          dismissed: false,
          createdAt: { gt: anterior },
        },
      });
      expect(db.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_dedupeKey: { userId: 'usuario-1', dedupeKey: 'new_jobs_2026-11-19' } },
          create: expect.objectContaining({ data: { count: 3, day: '2026-11-19' } }) as unknown,
        }),
      );
    });

    it('no primeiro resumo, conta as últimas 24 horas', async () => {
      db.notification.findFirst.mockResolvedValue(null);
      db.jobMatch.count.mockResolvedValue(1);

      await notifyProcessor(job);
      expect(db.jobMatch.count.mock.lastCall?.[0]).toMatchObject({
        where: { createdAt: { gt: new Date('2026-11-18T11:00:00Z') } },
      });
    });

    it('sem vaga nova, não grava alerta', async () => {
      db.notification.findFirst.mockResolvedValue(null);
      db.jobMatch.count.mockResolvedValue(0);

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true, count: 0 });
      expect(db.notification.upsert).not.toHaveBeenCalled();
    });

    it('não avisa conta excluída', async () => {
      db.user.findUnique.mockResolvedValue({ deletedAt: new Date() });

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true });
      expect(db.jobMatch.count).not.toHaveBeenCalled();
    });
  });

  describe('resumo diário de follow-ups', () => {
    const job = umJob({ kind: 'follow_ups', userId: 'usuario-1', day: '2026-11-19' });

    beforeEach(() => {
      db.user.findUnique.mockResolvedValue({ deletedAt: null });
    });

    it('conta as enviadas sem resposta que chegaram a uma semana desde o resumo anterior', async () => {
      db.notification.findFirst.mockResolvedValue({ createdAt: new Date('2026-11-18T11:00:00Z') });
      db.application.count.mockResolvedValue(2);

      await notifyProcessor(job);
      expect(db.notification.findFirst.mock.lastCall?.[0]).toMatchObject({
        where: { userId: 'usuario-1', kind: 'follow_ups_due' },
      });
      expect(db.application.count).toHaveBeenCalledWith({
        where: {
          userId: 'usuario-1',
          status: 'sent',
          followedUpAt: null,
          // enviadas entre 7 dias antes do resumo anterior e 7 dias antes de agora
          sentAt: { gt: new Date('2026-11-11T11:00:00Z'), lte: new Date('2026-11-12T11:00:00Z') },
        },
      });
      expect(db.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_dedupeKey: { userId: 'usuario-1', dedupeKey: 'follow_ups_due_2026-11-19' },
          },
          create: expect.objectContaining({
            kind: 'follow_ups_due',
            data: { count: 2, day: '2026-11-19' },
          }) as unknown,
        }),
      );
    });

    it('nenhuma chegou ao prazo, nada sai', async () => {
      db.notification.findFirst.mockResolvedValue(null);
      db.application.count.mockResolvedValue(0);

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true, count: 0 });
      expect(db.notification.upsert).not.toHaveBeenCalled();
    });

    it('não avisa conta excluída', async () => {
      db.user.findUnique.mockResolvedValue({ deletedAt: new Date() });

      await expect(notifyProcessor(job)).resolves.toEqual({ skipped: true });
      expect(db.application.count).not.toHaveBeenCalled();
    });
  });
});
