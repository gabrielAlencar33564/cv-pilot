import { CompanySuggestionStatus, type CompanySuggestionRow } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import { HttpError } from '../../plugins/errors';

/**
 * Sugestões por usuário em 24 h. Cada uma faz o bot visitar um site em nome do usuário: o
 * teto impede usar o detector para mandar o bot a dezenas de sites.
 */
const MAX_SUGGESTIONS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;
/** A lista mostra as sugestões mais recentes; as antigas já cumpriram o papel. */
const MAX_LISTED = 50;

const ROW_SELECT = {
  id: true,
  url: true,
  status: true,
  sourceId: true,
  createdAt: true,
  careerBoard: { select: { token: true } },
} as const;

function toRow(s: {
  id: string;
  url: string;
  status: string;
  sourceId: string | null;
  createdAt: Date;
  careerBoard: { token: string } | null;
}): CompanySuggestionRow {
  return {
    id: s.id,
    url: s.url,
    status: CompanySuggestionStatus.parse(s.status),
    sourceId: s.sourceId,
    boardToken: s.careerBoard?.token ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

/** "Adicionar empresa": registra a página de carreiras e manda o worker detectar o ATS. */
export async function suggestCompany(
  userId: string,
  input: { url: string },
  now = new Date(),
): Promise<CompanySuggestionRow> {
  const recent = await prisma.companySuggestion.count({
    where: { userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
  });
  if (recent >= MAX_SUGGESTIONS_PER_DAY) throw new HttpError(429, 'suggestion_limit_reached');

  const suggestion = await prisma.companySuggestion.create({
    data: { userId, url: input.url },
    select: ROW_SELECT,
  });
  await enqueue(
    'company-detect',
    { suggestionId: suggestion.id },
    { jobId: `company_detect_${suggestion.id}` },
  );
  return toRow(suggestion);
}

export async function listCompanySuggestions(userId: string): Promise<CompanySuggestionRow[]> {
  const suggestions = await prisma.companySuggestion.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_LISTED,
    select: ROW_SELECT,
  });
  return suggestions.map(toRow);
}
