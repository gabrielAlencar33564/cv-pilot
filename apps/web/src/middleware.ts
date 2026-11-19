import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIES, isPublicPath } from '@/lib/session';

/**
 * Quem não tem o cookie de sessão vai para a entrada. É só um atalho de navegação:
 * quem valida a sessão é a API, em toda requisição.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession || isPublicPath(pathname)) return NextResponse.next();

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // tudo, menos os arquivos estáticos do Next e o favicon
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
