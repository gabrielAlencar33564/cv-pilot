import { api } from './api';

/** Rotas abertas, sem login: entrada, cadastro e os termos. */
const PUBLIC_PATHS = ['/login', '/cadastro', '/termos'];

export const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Para onde ir depois de entrar: só caminhos internos (`/vagas`), nunca outro site
 * (`//site.com`, `/\site.com` ou `https://...`), para o link de login não virar redirecionamento aberto.
 */
export function safeNextPath(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : '/';
}

/**
 * Cookie de sessão do Better Auth (prefixo `cvpilot` na API). Em HTTPS ele ganha o prefixo
 * `__Secure-`. O middleware só confere se existe; quem valida a sessão é a API.
 */
export const SESSION_COOKIES = ['cvpilot.session_token', '__Secure-cvpilot.session_token'];

/** Mensagens em pt-BR para os códigos de erro do login; os demais aparecem como vieram. */
const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este e-mail.',
  PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'A senha é longa demais.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
  INVALID_PASSWORD: 'Senha atual incorreta.',
};

export const authErrorMessage = (err: Error) => AUTH_ERRORS[err.message] ?? err.message;

export const signIn = (email: string, password: string) =>
  api('/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) });

export const signUp = (name: string, email: string, password: string) =>
  api('/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name, email, password }) });

export const signOut = () => api('/auth/sign-out', { method: 'POST', body: '{}' });
