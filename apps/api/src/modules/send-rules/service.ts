import type { SendRuleInput } from '@cv-pilot/contracts';
import { resolveSendRule } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

type ParsedRule = Omit<SendRuleInput, 'defaultAnswers'> & { defaultAnswers: Record<string, string> };

/**
 * Garante que não existam duas regras com o mesmo escopo.
 * (O índice único do Postgres não cobre escopos com NULL.)
 */
async function assertScopeFree(userId: string, rule: ParsedRule, ignoreId?: string) {
  const existing = await prisma.sendRule.findFirst({
    where: {
      userId,
      sourceId: rule.sourceId ?? null,
      searchProfileId: rule.searchProfileId ?? null,
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
  });
  if (existing) throw new HttpError(409, 'send_rule_scope_already_exists');
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
      include: { resume: { select: { id: true, name: true } }, source: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(userId: string, rule: ParsedRule) {
    await assertOwnership(userId, rule);
    await assertScopeFree(userId, rule);
    return prisma.sendRule.create({ data: { ...rule, userId } });
  },

  async update(userId: string, id: string, rule: ParsedRule) {
    const current = await prisma.sendRule.findFirst({ where: { id, userId } });
    if (!current) throw new HttpError(404, 'send_rule_not_found');
    await assertOwnership(userId, rule);
    await assertScopeFree(userId, rule, id);
    return prisma.sendRule.update({ where: { id }, data: rule });
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
