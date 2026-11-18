---
name: testes
description: Escreve e corrige testes do CV Pilot com Vitest. Cobre testes unitários do core, testes de contrato dos adapters com fixtures, rotas da API com app.inject e processors com dependências falsas. Use sempre que uma mudança alterar comportamento, ao corrigir um bug (primeiro um teste que reproduz o bug), ao criar o primeiro teste de um pacote, ou quando o usuário pedir testes, cobertura ou TDD.
---

# Testes no CV Pilot

## Princípios

- Teste o **comportamento observável**, não detalhes de implementação.
- Bug corrigido = primeiro um teste que falha, depois a correção que o faz passar.
- Testes determinísticos: sem rede real, sem relógio real (`vi.useFakeTimers()` / `vi.setSystemTime()`) e sem `Math.random` sem controle.
- Um comportamento por `it`, no formato preparar → agir → verificar.
- `describe` com o nome da unidade e `it` em pt-BR descrevendo o resultado: `it('cai para a regra do site')`.
- Dados mínimos: só os campos que importam para o caso. Se o mesmo objeto se repetir, crie um builder local (`const umaVaga = (o = {}) => ({ ...base, ...o })`).
- Nunca enfraqueça, comente ou apague um teste para ficar verde. Nunca deixe `.only` ou `.skip`.

## Onde e como

- Ao lado do código: `src/dedupe.ts` → `src/dedupe.test.ts`. Fixtures em `src/<site>/fixtures/*.json`.
- Vitest `^3.2.4` já está em `@cv-pilot/core` e `@cv-pilot/adapters`. Para um pacote sem testes:
  ```bash
  pnpm --filter @cv-pilot/<pacote> add -D vitest@^3.2.4
  ```
  e adicione `"test": "vitest run"` ao `package.json` dele. A tarefa `test` do Turbo já roda depois do `generate` das dependências.
- Rodar:
  ```bash
  pnpm test                                                   # tudo
  pnpm --filter @cv-pilot/core test                           # um pacote
  pnpm --filter @cv-pilot/core exec vitest run src/dedupe.test.ts   # um arquivo
  pnpm --filter @cv-pilot/core exec vitest                    # modo watch
  ```

## Por camada

### `packages/core`: unitário puro (prioridade máxima)

Toda regra de negócio nova nasce aqui e com teste. Cubra o caminho feliz, os limites (lista vazia, 0, 100, `null`) e as precedências. Modelo, no estilo de [send-rules.test.ts](../../../packages/core/src/send-rules.test.ts):

```ts
import { describe, expect, it } from 'vitest';
import { jobDedupeHash } from './dedupe';

describe('jobDedupeHash', () => {
  it('ignora acentos, caixa e pontuação', () => {
    const a = jobDedupeHash({ company: 'Empresa X', title: 'Desenvolvedor Front-end', location: 'São Paulo' });
    const b = jobDedupeHash({ company: 'empresa x', title: 'DESENVOLVEDOR FRONT END', location: 'Sao Paulo' });
    expect(a).toBe(b);
  });
});
```

### `packages/adapters`: contrato com fixture

- A fixture é uma resposta **real** do site, reduzida ao necessário e **sem dados pessoais**.
- Teste o `normalize()` (campos mapeados) e garanta o contrato com `NormalizedJob.parse(resultado)`.
- Teste o `search()` com um `ctx.http` falso. Nunca acesse a rede.

```ts
import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import type { AdapterContext } from '../types';
import { gupyAdapter, type GupyRawJob } from './index';
import fixture from './fixtures/vaga-presencial.json';

const ctxCom = (paginas: GupyRawJob[][]): AdapterContext => {
  let chamada = 0;
  return {
    http: async () => new Response(JSON.stringify({ data: paginas[chamada++] ?? [] })),
    config: {},
    log: () => {},
    maxResults: 10,
  };
};

describe('gupyAdapter', () => {
  it('normaliza para o contrato interno', () => {
    expect(() => NormalizedJob.parse(gupyAdapter.normalize(fixture as GupyRawJob))).not.toThrow();
  });

  it('para quando a página vem incompleta', async () => {
    const vagas: GupyRawJob[] = [];
    for await (const raw of gupyAdapter.search({ keywords: ['react'] }, ctxCom([[fixture as GupyRawJob]]))) {
      vagas.push(raw);
    }
    expect(vagas).toHaveLength(1);
  });
});
```

Para importar JSON, o `resolveJsonModule` já está ligado no tsconfig base.

### `apps/api`: rotas com `app.inject`

- Use `buildApp()` + `app.inject()`, sem `listen`.
- As rotas usam o `prisma` diretamente, então o teste precisa de um **Postgres de teste separado** (ex.: banco `cvpilot_test` no Postgres do `pnpm infra:up`, com `DATABASE_URL` apontando para ele e migrations aplicadas via `prisma migrate deploy`). **Nunca rode testes contra o banco de dev.** Na primeira vez, configure isso no `vitest.config.ts` do pacote e documente no README.
- Em dev, o `authPlugin` aceita o header `x-dev-user-id`. Use-o para simular usuários diferentes.
- Para todo endpoint, teste: caminho feliz, 400 (entrada inválida), **404 para recurso de outro usuário** e conflitos (409) quando houver.
- Cada teste cria os próprios dados (ids únicos) e limpa o que criou.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';

describe('GET /search-profiles', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('não mostra perfis de outro usuário', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search-profiles',
      headers: { 'x-dev-user-id': 'usuario-sem-perfis' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
```

### `apps/workers`: processors

- Antes de testar um processor, veja se a lógica não deveria estar no `core`. Processor bom é fino.
- Chame a função exportada com um job montado à mão: `{ data: { ... } } as Job<QueuePayloads['match']>`. Em teste, esse cast é aceitável.
- Isole o Redis com `vi.mock('@cv-pilot/queue', ...)` e verifique as chamadas a `enqueue`.
- Banco: o mesmo Postgres de teste da API.
- Cubra a idempotência: rodar o mesmo job duas vezes não duplica efeito.

### `apps/web`

- Funções puras (formatação, mapeamentos): Vitest comum.
- Componentes: quando surgir o primeiro teste de componente, adicione `@testing-library/react` + `jsdom` só ao `apps/web`.
- Fluxos críticos (criar perfil → regra → vaga aparece → candidatar): e2e com Playwright, a partir da Etapa 2 de `docs/melhorias.md`.

## O que não fazer

- Não teste bibliotecas (Prisma, Zod, Mantine, BullMQ). Teste o seu código.
- Não use snapshot de objetos grandes. Prefira `toMatchObject` com os campos que importam.
- Não crie dependência de ordem entre testes nem estado global compartilhado.
- Não chame sites ou APIs de IA reais em teste.

## Checklist

- [ ] O comportamento novo ou corrigido tem teste, e o teste falharia sem a mudança
- [ ] Limites e casos de erro cobertos
- [ ] Sem rede, sem relógio real, sem `.only`/`.skip`
- [ ] `pnpm check` passa (o lint também barra `.only`/`.skip` esquecidos)
