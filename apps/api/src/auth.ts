import { prisma } from '@cv-pilot/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { corsOrigins, requiredEnv } from './config';

/** Prefixo das rotas de login na API (cadastro, entrar, sair, sessão, troca de senha). */
export const AUTH_PATH = '/auth';

/** Senha mínima no cadastro e na troca de senha. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * URL pública das rotas de login, já com o caminho: `http://localhost:4000/auth` no dev e
 * `https://<domínio>/api/auth` em produção. O Better Auth casa as rotas pelo caminho desta URL.
 */
export const AUTH_URL = requiredEnv('BETTER_AUTH_URL');

/**
 * Login por e-mail e senha (Better Auth), com sessões no Postgres e cookie httpOnly.
 * Sem verificação de e-mail nem recuperação de senha: o envio de e-mail ainda não existe.
 */
export const auth = betterAuth({
  baseURL: AUTH_URL,
  secret: requiredEnv('BETTER_AUTH_SECRET'),
  trustedOrigins: corsOrigins(),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    requireEmailVerification: false,
  },
  advanced: { cookiePrefix: 'cvpilot' },
});
