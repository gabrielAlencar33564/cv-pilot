import type { SendRuleInput } from '@cv-pilot/contracts';
import { resolveSendRule } from '@cv-pilot/core';
import { Prisma, prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

type ParsedRule = Omit<SendRuleInput, 'defaultAnswers'> & {
  defaultAnswers: Record<string, string>;
};

const SCOPE_TAKEN = 'send_rule_scope_already_exists';

/** Checagem prévia de escopo duplicado, para responder 409 antes de tentar gravar. */
async function assertScopeFree(userId: string, rule: ParsedRule, ignoreId?: string) {
  const existing = await prisma.sendRule.findFirst({
    where: {
      userId,
      sourceId: rule.sourceId ?? null,
      searchProfileId: rule.searchProfileId ?? null,
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
  });
  if (existing) throw new HttpError(409, SCOPE_TAKEN);
}

/**
 * Duas requisições simultâneas passam juntas pela checagem prévia; quem decide é o índice
 * único (NULLS NOT DISTINCT), e a violação dele (P2002) também vira 409.
 */
async function rejectScopeConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, SCOPE_TAKEN);
    }
    throw err;
  }
}

async function assertOwnership(userId: string, rule: ParsedRule) {
  const resume = await prisma.resume.findFirst({ where: { id: rule.resumeId, userId } });
  if (!resume) throw new HttpError(400, 'resume_not_found');
  if (rule.searchProfileId) {
    const p = await prisma.searchProfile.findFirst({ where: { id: rule.searchProfileId, userId } });
    if (!p) throw new HttpError(400, 'search_profile_not_found');
  }
  if (rule.coverLetterTemplateId) {
    const t = await prisma.coverLetterTemplate.findFirst({
      where: { id: rule.coverLetterTemplateId, userId },
    });
    if (!t) throw new HttpError(400, 'cover_letter_template_not_found');
  }
}

export const sendRuleService = {
  list(userId: string) {
    return prisma.sendRule.findMany({
      where: { userId },
      include: {
        resume: { select: { id: true, name: true } },
        source: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(userId: string, rule: ParsedRule) {
    await assertOwnership(userId, rule);
    await assertScopeFree(userId, rule);
    return rejectScopeConflict(prisma.sendRule.create({ data: { ...rule, userId } }));
  },

  async update(userId: string, id: string, rule: ParsedRule) {
    const current = await prisma.sendRule.findFirst({ where: { id, userId } });
    if (!current) throw new HttpError(404, 'send_rule_not_found');
    await assertOwnership(userId, rule);
    await assertScopeFree(userId, rule, id);
    return rejectScopeConflict(prisma.sendRule.update({ where: { id }, data: rule }));
  },

  async remove(userId: string, id: string) {
    const { count } = await prisma.sendRule.deleteMany({ where: { id, userId } });
    if (!count) throw new HttpError(404, 'send_rule_not_found');
  },

  /** Qual regra será usada para um site (e opcionalmente um perfil de busca). */
  async resolve(userId: string, sourceId: string, searchProfileId?: string) {
    const rules = await prisma.sendRule.findMany({ where: { userId } });
    return resolveSendRule(rules, { sourceId, searchProfileId }) ?? null;
  },
};
