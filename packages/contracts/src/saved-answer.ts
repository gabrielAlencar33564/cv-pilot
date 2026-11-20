import { z } from 'zod';

/** Pergunta curta demais casaria com qualquer rótulo ("Sim", "Nome"). */
export const MIN_QUESTION_CHARS = 4;
const MAX_QUESTION_CHARS = 300;
const MAX_ANSWER_CHARS = 2000;
/** Teto de perguntas por formulário: além disso, é lixo da página, não pergunta. */
const MAX_QUESTIONS_PER_FORM = 30;

const Question = z.string().trim().min(MIN_QUESTION_CHARS).max(MAX_QUESTION_CHARS);

/** Pergunta do banco de respostas (ADR 0011), criada à mão pelo candidato. */
export const SavedAnswerInput = z.object({
  question: Question,
  answer: z.string().trim().min(1).max(MAX_ANSWER_CHARS),
});
export type SavedAnswerInput = z.infer<typeof SavedAnswerInput>;

/** Resposta de uma pergunta do banco. Vazia volta a pergunta para "sem resposta". */
export const SavedAnswerUpdateInput = z.object({
  answer: z.string().trim().max(MAX_ANSWER_CHARS),
});
export type SavedAnswerUpdateInput = z.infer<typeof SavedAnswerUpdateInput>;

export interface SavedAnswerRow {
  id: string;
  question: string;
  answer: string | null;
  /** quantas vezes a pergunta apareceu nos formulários */
  timesSeen: number;
  lastSeenAt: string;
}

/** Perguntas que a extensão encontrou num formulário e não soube responder. */
export const ExtensionQuestionsInput = z.object({
  questions: z.array(Question).max(MAX_QUESTIONS_PER_FORM),
});
export type ExtensionQuestionsInput = z.infer<typeof ExtensionQuestionsInput>;

/** As respostas do banco que a extensão usa: pergunta → resposta (só as respondidas). */
export const ExtensionAnswers = z.record(z.string(), z.string());
