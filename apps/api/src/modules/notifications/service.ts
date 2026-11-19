import { NotificationContent } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

/** A página de alertas mostra os mais recentes; os antigos ficam no banco e na exportação. */
const LIST_LIMIT = 50;

type NotificationItem = NotificationContent & { id: string; readAt: Date | null; createdAt: Date };

const countUnread = (userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } });

/**
 * O alerta guarda só ids; o texto que identifica a vaga ou o currículo é buscado aqui,
 * sempre filtrando pelo dono.
 */
async function withSubjects(userId: string, items: NotificationItem[]) {
  const applicationIds: string[] = [];
  const resumeIds: string[] = [];
  for (const item of items) {
    if (item.kind === 'needs_action') applicationIds.push(item.data.applicationId);
    if (item.kind === 'resume_parse_failed') resumeIds.push(item.data.resumeId);
  }
  const [applications, resumes] = await Promise.all([
    prisma.application.findMany({
      where: { id: { in: applicationIds }, userId },
      select: { id: true, job: { select: { title: true, company: true } } },
    }),
    prisma.resume.findMany({
      where: { id: { in: resumeIds }, userId },
      select: { id: true, name: true },
    }),
  ]);
  const jobs = new Map(applications.map((a) => [a.id, `${a.job.title} · ${a.job.company}`]));
  const resumeNames = new Map(resumes.map((r) => [r.id, r.name]));

  return items.map((item) => {
    if (item.kind === 'needs_action') {
      return { ...item, subject: jobs.get(item.data.applicationId) ?? null };
    }
    if (item.kind === 'resume_parse_failed') {
      return { ...item, subject: resumeNames.get(item.data.resumeId) ?? null };
    }
    return { ...item, subject: null };
  });
}

/** Alertas no app (RF-70/71), do mais novo para o mais antigo, e quantos faltam ler. */
export async function listNotifications(userId: string) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    }),
    countUnread(userId),
  ]);
  const items = rows.flatMap((row): NotificationItem[] => {
    const content = NotificationContent.safeParse({ kind: row.kind, data: row.data });
    // linha num formato que esta versão não conhece: fica fora da lista em vez de quebrá-la
    if (!content.success) return [];
    return [{ id: row.id, readAt: row.readAt, createdAt: row.createdAt, ...content.data }];
  });
  return { items: await withSubjects(userId, items), unreadCount };
}

export async function unreadNotificationCount(userId: string) {
  return { count: await countUnread(userId) };
}

export async function markNotificationRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
    select: { readAt: true },
  });
  if (!notification) throw new HttpError(404, 'notification_not_found');
  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
