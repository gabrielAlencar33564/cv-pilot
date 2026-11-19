import { z } from 'zod';
import { ApplicationStatus } from './enums';

/** Atualização manual da candidatura pelo candidato (RF-62): status e anotações. */
export const ApplicationUpdateInput = z
  .object({
    status: ApplicationStatus.optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, {
    message: 'Informe o status ou as anotações',
  });
export type ApplicationUpdateInput = z.infer<typeof ApplicationUpdateInput>;
