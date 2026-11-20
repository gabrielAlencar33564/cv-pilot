import type { SavedAnswerRow } from '@cv-pilot/contracts';
import { questionKey } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

const rowSelect = {
  id: true,
  question: true,
  answer: true,
  timesSeen: true,
  lastSeenAt: true,
} as const;

const toRow = (a: {
  id: string;
  question: string;
  answer: string | null;
  timesSeen: number;
  lastSeenAt: Date;
}): SavedAnswerRow => ({ ...a, lastSeenAt: a.lastSeenAt.toISOString() });

/** O banco de respostas, com as perguntas sem resposta primeiro (ADR 0011). */
export async function listSavedAnswers(userId: string): Promise<SavedAnswerRow[]> {
  const answers = await prisma.savedAnswer.findMany({
    where: { userId },
    orderBy: [{ answer: { sort: 'asc', nulls: 'first' } }, { lastSeenAt: 'desc' }],
    select: rowSelect,
  });
  return answers.map(toRow);
}

/** Pergunta escrita à mão: se ela já está no banco, só ganha a resposta. */
export async function saveAnswer(userId: string, question: string, answer: string) {
  const key = questionKey(question);
  const saved = await prisma.savedAnswer.upsert({
    where: { userId_questionKey: { userId, questionKey: key } },
    create: { userId, question, questionKey: key, answer },
    update: { answer },
    select: rowSelect,
  });
  return toRow(saved);
}

export async function updateSavedAnswer(userId: string, id: string, answer: string) {
  const { count } = await prisma.savedAnswer.updateMany({
    where: { id, userId },
    data: { answer: answer || null },
  });
  if (!count) throw new HttpError(404, 'saved_answer_not_found');
  const updated = await prisma.savedAnswer.findUniqueOrThrow({ where: { id }, select: rowSelect });
  return toRow(updated);
}

export async function deleteSavedAnswer(userId: string, id: string) {
  const { count } = await prisma.savedAnswer.deleteMany({ where: { id, userId } });
  if (!count) throw new HttpError(404, 'saved_answer_not_found');
}

/**
 * Perguntas que a extensão não soube responder num formulário: entram no banco sem resposta,
 * ou contam mais uma aparição se já estavam lá. Devolve quantas ainda esperam resposta.
 */
export async function recordQuestions(userId: string, questions: readonly string[]) {
  // a mesma pergunta duas vezes no formulário: fica a primeira grafia
  const byKey = new Map<string, string>();
  for (const question of questions) {
    const key = questionKey(question);
    if (key && !byKey.has(key)) byKey.set(key, question);
  }
  const now = new Date();
  const saved = await prisma.$transaction(
    [...byKey].map(([key, question]) =>
      prisma.savedAnswer.upsert({
        where: { userId_questionKey: { userId, questionKey: key } },
        create: { userId, question, questionKey: key, lastSeenAt: now },
        update: { timesSeen: { increment: 1 }, lastSeenAt: now },
        select: { answer: true },
      }),
    ),
  );
  return { pending: saved.filter((a) => a.answer === null).length };
}

/** As respostas que a extensão usa ao preencher: pergunta → resposta. */
export async function answeredQuestions(userId: string): Promise<Record<string, string>> {
  const answers = await prisma.savedAnswer.findMany({
    where: { userId, answer: { not: null } },
    select: { question: true, answer: true },
  });
  return Object.fromEntries(answers.flatMap((a) => (a.answer ? [[a.question, a.answer]] : [])));
}
