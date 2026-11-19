import { prisma } from '@cv-pilot/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { corsOrigins, requiredEnv } from './config';
import { deleteUserFiles } from './modules/account/service';

/** Prefixo das rotas de login na API (cadastro, entrar, sair, sessão, troca de senha). */
export const AUTH_PATH = '/auth';

/** Senha mínima no cadastro e na troca de senha. */
const MIN_PASSWORD_LENGTH = 8;

/** Rota de exclusão da conta no Better Auth (RF-04). */
const DELETE_USER_PATH = '/delete-user';

const hasPassword = (body: unknown) =>
  typeof body === 'object' && body !== null && 'password' in body && Boolean(body.password);

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
  user: {
    deleteUser: {
      enabled: true,
      // os arquivos no S3 saem antes das linhas do banco; se algum falhar, nada é apagado
      beforeDelete: (user) => deleteUserFiles(user.id),
    },
  },
  hooks: {
    // o Better Auth aceita excluir sem senha quando a sessão é recente; aqui a senha é sempre exigida
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === DELETE_USER_PATH && !hasPassword(ctx.body)) {
        throw new APIError('BAD_REQUEST', {
          code: 'PASSWORD_REQUIRED',
          message: 'Informe a senha para excluir a conta',
        });
      }
    }),
  },
  advanced: { cookiePrefix: 'cvpilot' },
});
