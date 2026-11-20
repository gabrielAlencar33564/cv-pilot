import { z } from 'zod';

/**
 * O que o detector achou na página de carreiras sugerida (`CompanySuggestion.status`):
 * - `pending`: ainda na fila;
 * - `added`: a empresa usa um ATS lido por board e entrou no catálogo;
 * - `covered`: a fonte já lê todas as empresas dela (a Gupy, por palavra-chave);
 * - `not_detected`: nenhum ATS suportado na página, ou a empresa não existe nele;
 * - `unreachable`: o site bloqueou o bot, o robots.txt não permite, o endereço é interno ou não
 *   respondeu depois das tentativas.
 */
export const CompanySuggestionStatus = z.enum([
  'pending',
  'added',
  'covered',
  'not_detected',
  'unreachable',
]);
export type CompanySuggestionStatus = z.infer<typeof CompanySuggestionStatus>;

/** "Adicionar empresa": o endereço da página de carreiras, como o usuário colou. */
export const CreateCompanySuggestionInput = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .url('cole o endereço completo, começando com https://')
    .refine((url) => /^https?:\/\//i.test(url), 'use um endereço http ou https'),
});
export type CreateCompanySuggestionInput = z.input<typeof CreateCompanySuggestionInput>;

/** Uma sugestão na lista do usuário, com a empresa que entrou no catálogo, se entrou. */
export interface CompanySuggestionRow {
  id: string;
  url: string;
  status: CompanySuggestionStatus;
  sourceId: string | null;
  /** o slug da empresa no ATS, quando ela entrou no catálogo */
  boardToken: string | null;
  createdAt: string;
}
