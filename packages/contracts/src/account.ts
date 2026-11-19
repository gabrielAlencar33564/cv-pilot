import { z } from 'zod';

/** Links do perfil do candidato (`User.links`, guardado como JSON). */
export const ProfileLinks = z.object({
  linkedin: z.string().url().nullish(),
  github: z.string().url().nullish(),
  portfolio: z.string().url().nullish(),
});
export type ProfileLinks = z.infer<typeof ProfileLinks>;

/** Perfil base do candidato (RF-02). O e-mail não muda aqui: ele é o login. */
export const AccountProfileInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullish(),
  city: z.string().trim().max(120).nullish(),
  links: ProfileLinks.default({}),
  /** pretensão salarial mensal, em reais */
  salaryExpectation: z.number().int().nonnegative().nullish(),
  availability: z.string().trim().max(120).nullish(),
});
export type AccountProfileInput = z.input<typeof AccountProfileInput>;
