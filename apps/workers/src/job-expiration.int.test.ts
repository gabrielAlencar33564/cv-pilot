import { randomUUID } from 'node:crypto';
import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeMissing, expireStaleJobs } from './job-expiration';

const AGORA = new Date('2026-11-19T12:00:00Z');
const HORA = 60 * 60_000;
const DIA = 24 * HORA;
const sourceId = `teste-${randomUUID()}`;
const outraFonte = `teste-${randomUUID()}`;
let boardId: string;

/** Uma vaga com uma fonte; `extra` acrescenta a mesma vaga em outra fonte, ainda aberta. */
async function umaVaga(o: {
  lastSeen: Date;
  careerBoardId?: string;
  extra?: boolean;
}): Promise<string> {
  const id = randomUUID();
  await prisma.job.create({
    data: {
      id,
      dedupeHash: id,
      title: 'Vaga de teste',
      company: 'Empresa de teste',
      description: '',
      sources: {
        create: [
          {
            sourceId,
            externalId: id,
            url: 'https://example.com/vaga',
            lastSeen: o.lastSeen,
            careerBoardId: o.careerBoardId ?? null,
          },
          ...(o.extra
            ? [
                {
                  sourceId: outraFonte,
                  externalId: id,
                  url: 'https://example.com/outra',
                  lastSeen: AGORA,
                },
              ]
            : []),
        ],
      },
    },
  });
  return id;
}

const estado = async (jobId: string) => {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    select: { active: true, sources: { where: { sourceId }, select: { closedAt: true } } },
  });
  return { active: job.active, fechada: job.sources[0]?.closedAt != null };
};

describe('expiração de vagas', () => {
  beforeAll(async () => {
    await prisma.source.createMany({
      data: [sourceId, outraFonte].map((id) => ({
        id,
        displayName: 'Fonte de teste',
        kind: 'api',
        applyModes: [],
      })),
    });
    boardId = (
      await prisma.careerBoard.create({
        data: { sourceId, token: 'empresa' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { sources: { some: { sourceId } } } });
    // a cascata a partir da fonte apaga os boards
    await prisma.source.deleteMany({ where: { id: { in: [sourceId, outraFonte] } } });
  });

  it('fecha as vagas do board que não vieram na última ingestão e desativa as que ficaram sem fonte', async () => {
    const inicio = new Date(AGORA.getTime() - HORA);
    const vista = await umaVaga({ lastSeen: AGORA, careerBoardId: boardId });
    const sumiu = await umaVaga({
      lastSeen: new Date(inicio.getTime() - DIA),
      careerBoardId: boardId,
    });
    const sumiuMasTemOutraFonte = await umaVaga({
      lastSeen: new Date(inicio.getTime() - DIA),
      careerBoardId: boardId,
      extra: true,
    });

    await closeMissing({ careerBoardId: boardId }, inicio);

    expect(await estado(vista)).toEqual({ active: true, fechada: false });
    expect(await estado(sumiu)).toEqual({ active: false, fechada: true });
    expect(await estado(sumiuMasTemOutraFonte)).toEqual({ active: true, fechada: true });
  });

  it('fecha o que ninguém vê há mais de 14 dias, mesmo fora de um board', async () => {
    const recente = await umaVaga({ lastSeen: new Date(AGORA.getTime() - 13 * DIA) });
    const antiga = await umaVaga({ lastSeen: new Date(AGORA.getTime() - 15 * DIA) });

    await expireStaleJobs(AGORA);

    expect(await estado(recente)).toEqual({ active: true, fechada: false });
    expect(await estado(antiga)).toEqual({ active: false, fechada: true });
  });

  it('fecha o que sumiu da listagem completa da fonte, sem mexer nas outras fontes', async () => {
    const inicio = new Date(AGORA.getTime() - HORA);
    const vista = await umaVaga({ lastSeen: AGORA });
    const sumiu = await umaVaga({ lastSeen: new Date(inicio.getTime() - DIA) });
    const sumiuMasTemOutraFonte = await umaVaga({
      lastSeen: new Date(inicio.getTime() - DIA),
      extra: true,
    });

    await closeMissing({ sourceId }, inicio);

    expect(await estado(vista)).toEqual({ active: true, fechada: false });
    expect(await estado(sumiu)).toEqual({ active: false, fechada: true });
    expect(await estado(sumiuMasTemOutraFonte)).toEqual({ active: true, fechada: true });
  });
});
