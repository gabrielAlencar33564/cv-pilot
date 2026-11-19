import type { AdminSourceRow, CareerBoardRow, Paginated } from '@cv-pilot/contracts';
import { sourceHealth } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';

/** O admin mostra a saúde das fontes nas últimas 24 horas (RF-80). */
const HEALTH_WINDOW_MS = 24 * 60 * 60_000;

const countBy = <K extends string>(rows: { key: K | null; count: number }[]) =>
  new Map(rows.flatMap((r) => (r.key ? [[r.key, r.count] as const] : [])));

/** Todas as fontes, ativas ou não, com a saúde e os números das últimas 24 horas. */
export async function listAdminSources(now = new Date()): Promise<AdminSourceRow[]> {
  const since = new Date(now.getTime() - HEALTH_WINDOW_MS);
  const [sources, runs, openJobs, boards] = await Promise.all([
    prisma.source.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        kind: true,
        active: true,
        rateLimitReqs: true,
        rateLimitMs: true,
        lastRunAt: true,
        lastError: true,
      },
    }),
    prisma.sourceRun.groupBy({
      by: ['sourceId', 'status'],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
      _sum: { found: true },
    }),
    prisma.jobSource.groupBy({
      by: ['sourceId'],
      where: { closedAt: null },
      _count: { _all: true },
    }),
    prisma.careerBoard.groupBy({ by: ['sourceId'], _count: { _all: true } }),
  ]);
  const openBySource = countBy(openJobs.map((r) => ({ key: r.sourceId, count: r._count._all })));
  const boardsBySource = countBy(boards.map((r) => ({ key: r.sourceId, count: r._count._all })));

  return sources.map((source) => {
    const own = runs.filter((r) => r.sourceId === source.id);
    const runs24h = own.reduce((total, r) => total + r._count._all, 0);
    const failures24h = own
      .filter((r) => r.status !== 'success')
      .reduce((total, r) => total + r._count._all, 0);
    return {
      ...source,
      lastRunAt: source.lastRunAt?.toISOString() ?? null,
      health: sourceHealth({ active: source.active, runs: runs24h, failures: failures24h }),
      runs24h,
      failures24h,
      found24h: own.reduce((total, r) => total + (r._sum.found ?? 0), 0),
      openJobs: openBySource.get(source.id) ?? 0,
      careerBoards: boardsBySource.get(source.id) ?? 0,
    };
  });
}

/** Empresas do catálogo de uma fonte, das mais problemáticas (com erro) para as demais. */
export async function listCareerBoards(
  sourceId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<CareerBoardRow>> {
  const where = { sourceId };
  const [boards, total] = await Promise.all([
    prisma.careerBoard.findMany({
      where,
      orderBy: [{ lastError: { sort: 'asc', nulls: 'last' } }, { token: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sourceId: true,
        token: true,
        active: true,
        lastFetchedAt: true,
        lastError: true,
      },
    }),
    prisma.careerBoard.count({ where }),
  ]);
  const open = await prisma.jobSource.groupBy({
    by: ['careerBoardId'],
    where: { closedAt: null, careerBoardId: { in: boards.map((b) => b.id) } },
    _count: { _all: true },
  });
  const openByBoard = countBy(open.map((r) => ({ key: r.careerBoardId, count: r._count._all })));

  return {
    items: boards.map((b) => ({
      ...b,
      lastFetchedAt: b.lastFetchedAt?.toISOString() ?? null,
      openJobs: openByBoard.get(b.id) ?? 0,
    })),
    page,
    pageSize,
    total,
  };
}
