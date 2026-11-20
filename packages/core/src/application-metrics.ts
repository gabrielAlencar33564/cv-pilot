import type {
  ApplicationMetrics,
  ApplicationStatus,
  FunnelByResume,
  FunnelByResumeAndSource,
  FunnelBySource,
  FunnelCounts,
} from '@cv-pilot/contracts';

/** Status que só existem depois do envio: quem passou por eles foi enviada, mesmo sem `sentAt`. */
const AFTER_SENT: readonly string[] = [
  'sent',
  'in_process',
  'interview',
  'offer',
  'rejected',
  'no_response',
] satisfies ApplicationStatus[];
/** A empresa deu algum retorno, mesmo que fosse a recusa. */
const RESPONDED: readonly string[] = [
  'in_process',
  'interview',
  'offer',
  'rejected',
] satisfies ApplicationStatus[];
const INTERVIEWED: readonly string[] = ['interview', 'offer'] satisfies ApplicationStatus[];

export interface MetricsApplication {
  status: string;
  sentAt: Date | null;
  /** `Application.log`: JSON livre, com as mudanças de status (`status_changed`) */
  log: unknown;
  resume: { id: string; name: string };
  source: { id: string; name: string };
}

/** Status pelos quais a candidatura já passou: o atual e os destinos do histórico. */
function reachedStatuses(status: string, log: unknown): Set<string> {
  const reached = new Set([status]);
  if (!Array.isArray(log)) return reached;
  const entries: unknown[] = log;
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    if (!('type' in entry) || entry.type !== 'status_changed') continue;
    if ('to' in entry && typeof entry.to === 'string') reached.add(entry.to);
  }
  return reached;
}

const emptyFunnel = (): FunnelCounts => ({ sent: 0, responded: 0, interviews: 0, offers: 0 });

/** Quanto uma candidatura soma a cada etapa do funil; null quando nunca foi enviada. */
function funnelOf(application: MetricsApplication): FunnelCounts | null {
  const reached = reachedStatuses(application.status, application.log);
  const hits = (statuses: readonly string[]) => statuses.some((s) => reached.has(s));
  if (!application.sentAt && !hits(AFTER_SENT)) return null;
  return {
    sent: 1,
    responded: hits(RESPONDED) ? 1 : 0,
    interviews: hits(INTERVIEWED) ? 1 : 0,
    offers: reached.has('offer') ? 1 : 0,
  };
}

function add(target: FunnelCounts, funnel: FunnelCounts) {
  target.sent += funnel.sent;
  target.responded += funnel.responded;
  target.interviews += funnel.interviews;
  target.offers += funnel.offers;
}

/** Soma o funil num grupo, criando o grupo (zerado) na primeira vez que a chave aparece. */
function addTo<T extends FunnelCounts>(
  groups: Map<string, T>,
  key: string,
  create: () => T,
  funnel: FunnelCounts,
) {
  let group = groups.get(key);
  if (!group) {
    group = create();
    groups.set(key, group);
  }
  add(group, funnel);
}

/** Mais enviadas primeiro: é onde a taxa diz mais. */
const bySentDesc = (a: FunnelCounts, b: FunnelCounts) => b.sent - a.sent;

/**
 * Funil das candidaturas enviadas por currículo, por site e por currículo × site (RF-63).
 * As que nunca saíram (sugeridas, na fila, ação necessária, falhas) ficam fora.
 */
export function applicationMetrics(applications: MetricsApplication[]): ApplicationMetrics {
  const totals = emptyFunnel();
  const byResume = new Map<string, FunnelByResume>();
  const bySource = new Map<string, FunnelBySource>();
  const byPair = new Map<string, FunnelByResumeAndSource>();

  for (const application of applications) {
    const funnel = funnelOf(application);
    if (!funnel) continue;
    const resume = { resumeId: application.resume.id, resumeName: application.resume.name };
    const source = { sourceId: application.source.id, sourceName: application.source.name };
    add(totals, funnel);
    addTo(byResume, resume.resumeId, () => ({ ...resume, ...emptyFunnel() }), funnel);
    addTo(bySource, source.sourceId, () => ({ ...source, ...emptyFunnel() }), funnel);
    const pairKey = `${resume.resumeId}:${source.sourceId}`;
    addTo(byPair, pairKey, () => ({ ...resume, ...source, ...emptyFunnel() }), funnel);
  }

  return {
    totals,
    byResume: [...byResume.values()].sort(bySentDesc),
    bySource: [...bySource.values()].sort(bySentDesc),
    byResumeAndSource: [...byPair.values()].sort(bySentDesc),
  };
}
