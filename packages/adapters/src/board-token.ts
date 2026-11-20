import { CareerBoardToken } from '@cv-pilot/contracts';
import type { AtsRecognition } from './types';

/** Um trecho da URL vira o token da empresa se tiver o formato aceito pelo catálogo. */
export function boardFrom(candidate: string | null | undefined): AtsRecognition | null {
  const token = CareerBoardToken.safeParse(candidate ?? '');
  return token.success ? { kind: 'board', token: token.data } : null;
}

/** Primeiro trecho do caminho: "/nubank/jobs/123" → "nubank". */
export const firstPathSegment = (url: URL) => url.pathname.split('/').find(Boolean);
