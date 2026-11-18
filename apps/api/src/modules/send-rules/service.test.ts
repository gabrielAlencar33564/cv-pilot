import { Prisma } from '@cv-pilot/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendRuleService } from './service';

// prisma falso: o teste cobre a tradução de erros do serviço, sem banco
const db = vi.hoisted(() => ({
  sendRule: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  resume: { findFirst: vi.fn() },
}));

vi.mock('@cv-pilot/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  prisma: db,
}));

const umaRegra = { resumeId: 'curriculo-1', defaultAnswers: {} };

const erroDoPrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('falha simulada', { code, clientVersion: 'teste' });

describe('sendRuleService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.resume.findFirst.mockResolvedValue({ id: 'curriculo-1' });
  });

  it('responde 409 quando o índice único barra uma regra criada ao mesmo tempo', async () => {
    db.sendRule.findFirst.mockResolvedValue(null);
    db.sendRule.create.mockRejectedValue(erroDoPrisma('P2002'));

    await expect(sendRuleService.create('usuario-1', umaRegra)).rejects.toMatchObject({
      statusCode: 409,
      message: 'send_rule_scope_already_exists',
    });
  });

  it('responde 409 quando a edição colide com outra regra no índice único', async () => {
    db.sendRule.findFirst.mockResolvedValueOnce({ id: 'regra-1' }).mockResolvedValueOnce(null);
    db.sendRule.update.mockRejectedValue(erroDoPrisma('P2002'));

    await expect(sendRuleService.update('usuario-1', 'regra-1', umaRegra)).rejects.toMatchObject({
      statusCode: 409,
      message: 'send_rule_scope_already_exists',
    });
  });

  it('repassa outros erros do banco sem trocar por 409', async () => {
    const chaveEstrangeira = erroDoPrisma('P2003');
    db.sendRule.findFirst.mockResolvedValue(null);
    db.sendRule.create.mockRejectedValue(chaveEstrangeira);

    await expect(sendRuleService.create('usuario-1', umaRegra)).rejects.toBe(chaveEstrangeira);
  });
});
