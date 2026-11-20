import { z } from 'zod';

/**
 * Versão atual dos termos de uso e da política de privacidade (RF-03).
 * Mudar a versão faz todo usuário aceitar de novo antes de continuar usando o sistema.
 */
export const TERMS_VERSION = '2026-11-19.2';

export const ConsentInput = z.object({ termsVersion: z.string() });
export type ConsentInput = z.infer<typeof ConsentInput>;
