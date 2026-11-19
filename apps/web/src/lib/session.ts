import { TERMS_VERSION } from '@cv-pilot/contracts';
import { api } from './api';

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

/** Aceite da versão atual dos termos (grava versão, data e IP na API). */
export const acceptTerms = () =>
  api('/me/consents', { method: 'POST', body: JSON.stringify({ termsVersion: TERMS_VERSION }) });
