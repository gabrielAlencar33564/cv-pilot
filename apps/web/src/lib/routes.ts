/**
 * Rotas do web e o cookie que as protege. Sem dependências: o middleware do Next, o cliente
 * HTTP e as telas importam daqui.
 */

/** Página de entrada; quem perde a sessão volta para cá. */
export const LOGIN_PATH = '/login';

/** Rotas abertas, sem login: entrada, cadastro e os termos. */
const PUBLIC_PATHS = [LOGIN_PATH, '/cadastro', '/termos'];

const matches = (paths: readonly string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export const isPublicPath = (pathname: string) => matches(PUBLIC_PATHS, pathname);

/** Tela de aceite dos termos: exige login, mas aparece sem o menu, como as abertas. */
export const CONSENT_PATH = '/aceite';

/** Páginas que aparecem sem o menu lateral. */
export const isBarePath = (pathname: string) => matches([...PUBLIC_PATHS, CONSENT_PATH], pathname);

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
