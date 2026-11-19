import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

describe('rotas de perfis de busca', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  let perfilId: string;

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    const perfil = await prisma.searchProfile.create({
      data: { userId: dono.id, name: 'Front-end', keywords: ['react'], sourceIds: ['gupy'] },
    });
    perfilId = perfil.id;
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await app.close();
  });

  it('responde 404 ao buscar o perfil de outro usuário', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/search-profiles/${perfilId}`,
      headers: outro.headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'search_profile_not_found' });
  });

  it('não lista perfis de outro usuário', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search-profiles',
      headers: outro.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('não deixa outro usuário apagar o perfil', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/search-profiles/${perfilId}`,
      headers: outro.headers,
    });
    expect(res.statusCode).toBe(404);
    expect(await prisma.searchProfile.count({ where: { id: perfilId } })).toBe(1);
  });

  const perfilCompleto = {
    name: 'Front-end PJ',
    keywords: ['react'],
    sourceIds: ['gupy'],
    contractTypes: ['pj'],
    salaryMin: 8000,
    salaryMax: 12000,
    companyBlacklist: ['Empresa Ruim'],
    active: false,
  };

  it('edita contrato, faixa salarial e empresas excluídas', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/search-profiles/${perfilId}`,
      headers: dono.headers,
      payload: perfilCompleto,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject(perfilCompleto);
  });

  it('recusa faixa salarial com máximo abaixo do mínimo', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/search-profiles/${perfilId}`,
      headers: dono.headers,
      payload: { ...perfilCompleto, salaryMin: 12000, salaryMax: 8000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('não deixa outro usuário editar o perfil', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/search-profiles/${perfilId}`,
      headers: outro.headers,
      payload: perfilCompleto,
    });
    expect(res.statusCode).toBe(404);
  });

  it('devolve o perfil ao dono', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/search-profiles/${perfilId}`,
      headers: dono.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: perfilId, name: 'Front-end PJ' });
  });
});
