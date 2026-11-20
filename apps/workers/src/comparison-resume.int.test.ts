import { randomUUID } from 'node:crypto';
import { comparisonResumeVersion, prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('comparisonResumeVersion', () => {
  const userId = `teste-${randomUUID()}`;
  const outroUserId = `teste-${randomUUID()}`;
  let cvDaRegra: string;
  let cvLido: string;
  let versaoLida: string;

  /** Currículo com uma versão; `lida` diz se o resume-parse já a extraiu. */
  async function umCurriculo(dono: string, lida: boolean, parsedAt = new Date()) {
    const resume = await prisma.resume.create({ data: { userId: dono, name: 'CV' } });
    const version = await prisma.resumeVersion.create({
      data: {
        resumeId: resume.id,
        version: 1,
        storageKey: `${dono}/${resume.id}.pdf`,
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        ...(lida && { parseStatus: 'parsed', parsedAt, parsed: { skills: [] } }),
      },
    });
    return { resumeId: resume.id, versionId: version.id };
  }

  beforeAll(async () => {
    for (const id of [userId, outroUserId]) {
      await prisma.user.create({ data: { id, email: `${id}@teste.local` } });
    }
    cvDaRegra = (await umCurriculo(userId, false)).resumeId;
    ({ resumeId: cvLido, versionId: versaoLida } = await umCurriculo(userId, true));
    // um currículo lido mais recente, mas de outro usuário
    await umCurriculo(outroUserId, true, new Date(Date.now() + 60_000));
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, outroUserId] } } });
  });

  it('usa a versão lida do currículo da regra', async () => {
    await expect(comparisonResumeVersion(userId, cvLido)).resolves.toMatchObject({
      id: versaoLida,
    });
  });

  it('currículo da regra sem versão lida cai para o último lido do mesmo usuário', async () => {
    await expect(comparisonResumeVersion(userId, cvDaRegra)).resolves.toMatchObject({
      id: versaoLida,
    });
  });

  it('nunca usa o currículo de outro usuário, nem com o id dele', async () => {
    const semLido = `teste-${randomUUID()}`;
    await prisma.user.create({ data: { id: semLido, email: `${semLido}@teste.local` } });
    try {
      await expect(comparisonResumeVersion(semLido, cvLido)).resolves.toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: semLido } });
    }
  });
});
