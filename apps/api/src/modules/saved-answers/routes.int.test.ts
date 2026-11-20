import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

describe('banco de respostas (ADR 0011)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await app.close();
  });

  const pedir = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    usuario: TestUser,
    payload?: object,
  ) => app.inject({ method, url, headers: usuario.headers, ...(payload ? { payload } : {}) });

  it('lista as perguntas sem resposta primeiro', async () => {
    await prisma.savedAnswer.createMany({
      data: [
        { userId: dono.id, question: 'Possui CNH?', questionKey: 'possui cnh', answer: 'Sim' },
        { userId: dono.id, question: 'Aceita viajar?', questionKey: 'aceita viajar' },
      ],
    });

    const res = await pedir('GET', '/saved-answers', dono);
    expect(res.json<{ question: string }[]>().map((a) => a.question)).toEqual([
      'Aceita viajar?',
      'Possui CNH?',
    ]);
    expect((await pedir('GET', '/saved-answers', outro)).json()).toEqual([]);
  });

  it('responder, apagar a resposta e excluir a pergunta', async () => {
    const pergunta = await prisma.savedAnswer.create({
      data: { userId: dono.id, question: 'Tem filhos?', questionKey: 'tem filhos' },
    });

    const respondida = await pedir('PUT', `/saved-answers/${pergunta.id}`, dono, {
      answer: ' Prefiro não informar ',
    });
    expect(respondida.json()).toMatchObject({ answer: 'Prefiro não informar' });
    const vazia = await pedir('PUT', `/saved-answers/${pergunta.id}`, dono, { answer: '' });
    expect(vazia.json()).toMatchObject({ answer: null });

    expect((await pedir('DELETE', `/saved-answers/${pergunta.id}`, dono)).statusCode).toBe(204);
    expect(await prisma.savedAnswer.count({ where: { id: pergunta.id } })).toBe(0);
  });

  it('pergunta escrita à mão que já existe só ganha a resposta', async () => {
    await prisma.savedAnswer.create({
      data: { userId: dono.id, question: 'Pretensão salarial?', questionKey: 'pretensao salarial' },
    });

    const res = await pedir('POST', '/saved-answers', dono, {
      question: 'PRETENSÃO SALARIAL',
      answer: '9000',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ question: 'Pretensão salarial?', answer: '9000' });
    expect(
      await prisma.savedAnswer.count({
        where: { userId: dono.id, questionKey: 'pretensao salarial' },
      }),
    ).toBe(1);
  });

  it('não mexe na pergunta de outra pessoa', async () => {
    const alheia = await prisma.savedAnswer.create({
      data: { userId: outro.id, question: 'Possui carro?', questionKey: 'possui carro' },
    });

    expect(
      (await pedir('PUT', `/saved-answers/${alheia.id}`, dono, { answer: 'x' })).statusCode,
    ).toBe(404);
    expect((await pedir('DELETE', `/saved-answers/${alheia.id}`, dono)).statusCode).toBe(404);
  });

  it('recusa pergunta curta demais', async () => {
    const res = await pedir('POST', '/saved-answers', dono, { question: 'Sim', answer: 'x' });
    expect(res.statusCode).toBe(400);
  });
});
