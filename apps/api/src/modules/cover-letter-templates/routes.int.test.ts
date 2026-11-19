import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

describe('modelos de carta (RF-22)', () => {
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

  const criar = (payload: object, usuario = dono) =>
    app.inject({
      method: 'POST',
      url: '/cover-letter-templates',
      headers: usuario.headers,
      payload,
    });

  const modelo = { name: 'Padrão', body: 'Olá, {{empresa}}! Quero a vaga de {{cargo}}.' };

  it('cria, lista e edita um modelo', async () => {
    const criado = await criar(modelo);
    expect(criado.statusCode).toBe(201);
    const { id } = criado.json<{ id: string }>();

    const editado = await app.inject({
      method: 'PUT',
      url: `/cover-letter-templates/${id}`,
      headers: dono.headers,
      payload: { ...modelo, name: 'Formal' },
    });
    expect(editado.json()).toMatchObject({ id, name: 'Formal', body: modelo.body });

    const lista = await app.inject({
      method: 'GET',
      url: '/cover-letter-templates',
      headers: dono.headers,
    });
    expect(lista.json()).toEqual([expect.objectContaining({ id, name: 'Formal' })]);
  });

  it('recusa modelo sem texto', async () => {
    expect((await criar({ name: 'Vazio', body: '   ' })).statusCode).toBe(400);
  });

  it('não mostra, edita nem apaga o modelo de outro usuário', async () => {
    const { id } = (await criar(modelo)).json<{ id: string }>();

    const lista = await app.inject({
      method: 'GET',
      url: '/cover-letter-templates',
      headers: outro.headers,
    });
    expect(lista.json()).toEqual([]);
    const editar = await app.inject({
      method: 'PUT',
      url: `/cover-letter-templates/${id}`,
      headers: outro.headers,
      payload: modelo,
    });
    expect(editar.statusCode).toBe(404);
    const apagar = await app.inject({
      method: 'DELETE',
      url: `/cover-letter-templates/${id}`,
      headers: outro.headers,
    });
    expect(apagar.statusCode).toBe(404);
    expect(await prisma.coverLetterTemplate.count({ where: { id } })).toBe(1);
  });

  it('apagar o modelo deixa a regra de envio sem carta', async () => {
    const { id } = (await criar(modelo)).json<{ id: string }>();
    const resume = await prisma.resume.create({ data: { userId: dono.id, name: 'CV' } });
    const regra = await prisma.sendRule.create({
      data: { userId: dono.id, resumeId: resume.id, coverLetterTemplateId: id },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/cover-letter-templates/${id}`,
      headers: dono.headers,
    });
    expect(res.statusCode).toBe(204);
    const salva = await prisma.sendRule.findUniqueOrThrow({ where: { id: regra.id } });
    expect(salva.coverLetterTemplateId).toBeNull();
  });
});
