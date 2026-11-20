import { describe, expect, it } from 'vitest';
import { applicationMetrics, type MetricsApplication } from './application-metrics';

const tecnico = { id: 'r1', name: 'Técnico' };
const humanizado = { id: 'r2', name: 'Humanizado' };
const gupy = { id: 'gupy', name: 'Gupy' };
const lever = { id: 'lever', name: 'Lever' };

const mudou = (to: string) => ({ at: '2026-11-01T00:00:00.000Z', type: 'status_changed', to });

const candidatura = (o: Partial<MetricsApplication> = {}): MetricsApplication => ({
  status: 'sent',
  sentAt: new Date('2026-11-01'),
  log: [],
  resume: tecnico,
  source: gupy,
  ...o,
});

describe('applicationMetrics', () => {
  it('deixa fora o que nunca foi enviado', () => {
    const metricas = applicationMetrics([
      candidatura({ status: 'suggested', sentAt: null }),
      candidatura({ status: 'needs_action', sentAt: null }),
      candidatura({ status: 'failed', sentAt: null }),
    ]);

    expect(metricas.totals).toEqual({ sent: 0, responded: 0, interviews: 0, offers: 0 });
    expect(metricas.byResume).toEqual([]);
  });

  it('conta cada etapa que a candidatura alcançou, mesmo que depois tenha mudado', () => {
    const metricas = applicationMetrics([
      candidatura(),
      candidatura({ status: 'in_process' }),
      // entrevistou e foi recusada: conta como resposta e como entrevista
      candidatura({ status: 'rejected', log: [mudou('in_process'), mudou('interview')] }),
      candidatura({ status: 'offer' }),
      candidatura({ status: 'no_response' }),
    ]);

    expect(metricas.totals).toEqual({ sent: 5, responded: 3, interviews: 2, offers: 1 });
  });

  it('enviada antes de existir o sentAt conta pelo status', () => {
    const metricas = applicationMetrics([candidatura({ status: 'interview', sentAt: null })]);

    expect(metricas.totals).toMatchObject({ sent: 1, interviews: 1 });
  });

  it('ignora entradas do histórico que não são mudança de status', () => {
    const log = [null, 'x', { type: 'saved_from_page' }, { type: 'status_changed', to: 3 }];

    expect(applicationMetrics([candidatura({ log })]).totals.responded).toBe(0);
    expect(applicationMetrics([candidatura({ log: { not: 'array' } })]).totals.sent).toBe(1);
  });

  it('agrupa por currículo, por site e por currículo × site, mais enviadas primeiro', () => {
    const metricas = applicationMetrics([
      candidatura({ status: 'interview' }),
      candidatura({ source: lever }),
      candidatura({ resume: humanizado, source: lever, status: 'in_process' }),
      candidatura({ resume: humanizado, source: lever }),
      candidatura({ resume: humanizado, source: lever }),
    ]);

    expect(metricas.byResume).toEqual([
      { resumeId: 'r2', resumeName: 'Humanizado', sent: 3, responded: 1, interviews: 0, offers: 0 },
      { resumeId: 'r1', resumeName: 'Técnico', sent: 2, responded: 1, interviews: 1, offers: 0 },
    ]);
    expect(metricas.bySource.map((s) => [s.sourceName, s.sent, s.responded])).toEqual([
      ['Lever', 4, 1],
      ['Gupy', 1, 1],
    ]);
    expect(
      metricas.byResumeAndSource.map((p) => [p.resumeName, p.sourceName, p.sent, p.responded]),
    ).toEqual([
      ['Humanizado', 'Lever', 3, 1],
      ['Técnico', 'Gupy', 1, 1],
      ['Técnico', 'Lever', 1, 0],
    ]);
  });
});
