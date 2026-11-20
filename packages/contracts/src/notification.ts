import { z } from 'zod';

/**
 * Alertas dentro do app (RF-70/71). `data` leva só ids e contagens: nome da vaga, do
 * currículo etc. são buscados na hora de mostrar, sempre filtrando pelo dono.
 */
export const NotificationContent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('needs_action'), data: z.object({ applicationId: z.string() }) }),
  z.object({
    kind: z.literal('resume_parse_failed'),
    data: z.object({ resumeId: z.string(), resumeVersionId: z.string() }),
  }),
  z.object({
    kind: z.literal('new_jobs'),
    data: z.object({ count: z.number().int().positive(), day: z.string() }),
  }),
  z.object({
    kind: z.literal('follow_ups_due'),
    data: z.object({ count: z.number().int().positive(), day: z.string() }),
  }),
]);
export type NotificationContent = z.infer<typeof NotificationContent>;
