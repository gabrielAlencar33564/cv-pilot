---
name: modulo-api
description: Cria ou altera endpoints da API Fastify do CV Pilot (apps/api). Cobre rotas, serviços, validação com Zod, contratos compartilhados em packages/contracts, paginação, erros com HttpError e a checagem de dono por userId. Use ao adicionar ou mudar uma rota REST, um módulo de domínio, um schema de entrada ou saída, ou um plugin da API.
---

# Módulos da API (Fastify)

## Estrutura

```
apps/api/src/
├── app.ts                    # registra plugins e módulos (prefixo por domínio)
├── plugins/auth.ts           # preenche req.userId
├── plugins/errors.ts         # HttpError + errorHandler (ZodError → 400)
└── modules/<dominio>/
    ├── routes.ts             # FastifyPluginAsync: valida entrada e delega
    └── service.ts            # só quando há lógica além de uma chamada ao Prisma
```

Referências no código: rotas simples em [search-profiles/routes.ts](../../../apps/api/src/modules/search-profiles/routes.ts); rotas com serviço em [send-rules/service.ts](../../../apps/api/src/modules/send-rules/service.ts); paginação em [jobs/routes.ts](../../../apps/api/src/modules/jobs/routes.ts).

## Passo a passo

1. **Contrato.** Se a web ou a extensão enviam ou recebem o dado, o schema Zod vai para `packages/contracts/src/<dominio>.ts` e é exportado no `index.ts`. Siga o padrão: `FooInput = z.object(...)`, `type FooInput = z.input<typeof FooInput>`. Schemas usados só dentro da API podem ficar no módulo.
2. **Regra de negócio** pura vai para `packages/core`, com teste (skill `testes`).
3. **Rotas:**

   ```ts
   import { FooInput } from '@cv-pilot/contracts';
   import { prisma } from '@cv-pilot/db';
   import type { FastifyPluginAsync } from 'fastify';
   import { z } from 'zod';
   import { HttpError } from '../../plugins/errors';

   const IdParam = z.object({ id: z.string() });

   export const fooRoutes: FastifyPluginAsync = async (app) => {
     app.get('/:id', async (req) => {
       const { id } = IdParam.parse(req.params);
       const foo = await prisma.foo.findFirst({ where: { id, userId: req.userId } });
       if (!foo) throw new HttpError(404, 'foo_not_found');
       return foo;
     });

     app.post('/', async (req, reply) => {
       const data = FooInput.parse(req.body);
       return reply.code(201).send(await prisma.foo.create({ data: { ...data, userId: req.userId } }));
     });
   };
   ```

4. **Registrar** em `app.ts` com `await app.register(fooRoutes, { prefix: '/foos' })`, **depois** do `authPlugin`. Só `/health` fica antes.
5. **Web:** hook e tela (skill `tela-web`).
6. **Testes** com `app.inject` (skill `testes`): 2xx, 400, 404 de outro usuário, 409.

## Regras

**Isolamento por usuário (inegociável)**
- Toda leitura filtra por `userId: req.userId`.
- Update e delete usam `updateMany`/`deleteMany({ where: { id, userId } })` e checam `count`, ou fazem `findFirst` com `userId` antes, como nos módulos existentes.
- Ids que vêm no body (`resumeId`, `searchProfileId`, `coverLetterTemplateId`) precisam pertencer ao usuário. Veja `assertOwnership` em `send-rules/service.ts`.
- Recurso de outro usuário responde **404**, nunca 403, para não revelar que existe.

**Entrada e saída**
- Valide `params`, `query` e `body` com Zod (`.parse`). Use `z.coerce` para números na query.
- Retorne só o que a tela usa (`select`/`include`). **Nunca** retorne `passwordHash`, `encryptedTokens`, `JobSource.raw` ou o conteúdo de currículo de outro usuário.
- Listas grandes são paginadas no servidor com `Paginated<T>` (`page`, `pageSize` ≤ 100), como em `jobs/routes.ts`.

**Status HTTP e erros**
- 201 para criação, 204 para exclusão, 202 quando só enfileirou trabalho.
- `throw new HttpError(status, 'codigo_snake_case')`: 400 para entrada ou referência inválida, 401, 404, 409 para conflito ou duplicidade.
- Não capture erro só para trocar a mensagem. O `errorHandler` já esconde detalhes de erros 5xx.

**Trabalho pesado fora da requisição**
- Extração de CV, IA, envio de candidatura, e-mail e acesso a sites de vagas vão para a fila: `enqueue(...)` de `@cv-pilot/queue` (skill `fila-worker`). A rota só registra e responde.

**Estados**
- A mudança de status de `Application` deve passar por uma regra do `core` com as transições permitidas (item 10 de `docs/melhorias.md`). Não aceite um status arbitrário vindo do cliente.

**Segurança**
- Upload, login, OAuth e dados pessoais: siga a skill `lgpd-seguranca`.
- Rotas de admin exigem `role === 'ADMIN'`.

## Checklist

- [ ] Schema Zod em `contracts` quando a web usa o dado; nada de tipo duplicado à mão
- [ ] Todas as consultas filtradas por `userId`; ids do body validados
- [ ] Resposta sem campos sensíveis e paginada quando é lista
- [ ] Rota registrada em `app.ts` depois do `authPlugin`
- [ ] Testes de sucesso, validação, isolamento e conflito
- [ ] `docs/visao-geral.md` (tabela de rotas) atualizado se surgiu ou sumiu um endpoint
