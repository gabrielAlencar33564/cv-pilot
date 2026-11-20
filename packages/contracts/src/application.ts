import { z } from 'zod';
import { COVER_LETTER_MAX_CHARS } from './cover-letter';
import { ApplicationStatus } from './enums';

/**
 * Atualização manual da candidatura pelo candidato: status e anotações (RF-62) e a carta,
 * editável antes do envio (RF-54). Carta vazia tira a carta da candidatura.
 */
export const ApplicationUpdateInput = z
  .object({
    status: ApplicationStatus.optional(),
    notes: z.string().max(5000).optional(),
    coverLetter: z.string().trim().max(COVER_LETTER_MAX_CHARS).optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined || v.coverLetter !== undefined, {
    message: 'Informe o status, as anotações ou a carta',
  });
export type ApplicationUpdateInput = z.infer<typeof ApplicationUpdateInput>;
