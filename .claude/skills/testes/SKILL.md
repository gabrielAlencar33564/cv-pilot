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
- Vitest `^3.2.4` já está em `core`, `adapters`, `logger`, `queue`, `workers` e `api`. Para um pacote sem testes:
  ```bash
  pnpm --filter @cv-pilot/<pacote> add -D vitest@^3.2.4
  ```
  e adicione `"test": "vitest run"` ao `package.json` dele. A tarefa `test` do Turbo já roda depois do `generate` do pacote e das dependências.
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
    const a = jobDedupeHash({
      company: 'Empresa X',
      title: 'Desenvolvedor Front-end',
      location: 'São Paulo',
    });
    const b = jobDedupeHash({
      company: 'empresa x',
      title: 'DESENVOLVEDOR FRONT END',
      location: 'Sao Paulo',
    });
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
    for await (const raw of gupyAdapter.search(
      { keywords: ['react'] },
      ctxCom([[fixture as GupyRawJob]]),
    )) {
      vagas.push(raw);
    }
    expect(vagas).toHaveLength(1);
  });
});
```

Para importar JSON, o `resolveJsonModule` já está ligado no tsconfig base.

### `apps/api`: rotas com `app.inject`

- Use `buildApp()` + `app.inject()`, sem `listen`.
- As rotas usam o `prisma` diretamente, então o teste roda no **Postgres de teste** (`TEST_DATABASE_URL`, banco `cvpilot_test` no Postgres do `pnpm infra:up`). O arquivo se chama `*.int.test.ts` e roda com `pnpm test:integration`, fora do `pnpm check`; a CI roda num job à parte, com Postgres.
- O setup (`prepareTestDatabase` em [@cv-pilot/db/testing](../../../packages/db/src/testing.ts), usado pela integração da API e pelo E2E) cria o banco se faltar e aplica as migrations. Ele **recusa** uma URL que não termine em `_test` ou que seja igual ao `DATABASE_URL`: nunca rode testes contra o banco de dev.
- Login de verdade: `signUpTestUser(app)` ([test/db.ts](../../../apps/api/src/test/db.ts)) cadastra pelo Better Auth, aceita os termos e devolve `{ id, email, headers }`. Mande `headers` (cookie da sessão + `origin`) em cada `app.inject`. Para testar o bloqueio por termos, use `signUpTestUser(app, { acceptTerms: false })`.
- Apague os usuários no `afterAll` com `deleteTestUsers()`; a cascata a partir de `User` limpa o resto. Dados globais (como `Source` e `Job`) o teste cria com `uniqueId()` e apaga sozinho.
- O cadastro faz o hash da senha (scrypt), que é lento de propósito: a suíte de integração tem `testTimeout` de 30 s. Crie os usuários no `beforeAll`, não em cada teste.
- O próprio `authPlugin` é testado sem banco, numa instância Fastify mínima com o Better Auth falso ([auth.test.ts](../../../apps/api/src/plugins/auth.test.ts)).
- Fila e Redis ficam falsos nas rotas que enfileiram (`vi.mock('@cv-pilot/queue', ...)`), como em [jobs/routes.int.test.ts](../../../apps/api/src/modules/jobs/routes.int.test.ts).
- Regra do serviço que não depende do banco (por exemplo, traduzir um erro do Prisma em `HttpError`) pode ser testada com um `prisma` falso via `vi.mock('@cv-pilot/db')`, sem Postgres. Modelo: [send-rules/service.test.ts](../../../apps/api/src/modules/send-rules/service.test.ts).
- Para todo endpoint, teste: caminho feliz, 400 (entrada inválida), **404 para recurso de outro usuário** e conflitos (409) quando houver.
- Cada teste cria os próprios dados (ids únicos) e limpa o que criou.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

describe('GET /search-profiles', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let outro: TestUser;
  beforeAll(async () => {
    app = await buildApp();
    outro = await signUpTestUser(app);
  });
  afterAll(async () => {
    await deleteTestUsers(outro.id);
    await app.close();
  });

  it('não mostra perfis de outro usuário', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search-profiles',
      headers: outro.headers,
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
- Banco: prefira um `prisma` falso (`vi.mock('@cv-pilot/db')`), como em [match.test.ts](../../../apps/workers/src/processors/match.test.ts) e [resume-parse.test.ts](../../../apps/workers/src/processors/resume-parse.test.ts).
- Lógica que depende do Redis de verdade (atomicidade, TTL) vai num `*.int.test.ts` do pacote que fala com o Redis, contra o `TEST_REDIS_URL` (banco 15 do Redis de dev), como em [daily-limit.int.test.ts](../../../packages/queue/src/daily-limit.int.test.ts). Chaves com id único por execução, apagadas no `afterAll`.
- Cubra a idempotência: rodar o mesmo job duas vezes não duplica efeito.

### `apps/web`

- Funções puras (formatação, mapeamentos): Vitest comum.
- Componentes: quando surgir o primeiro teste de componente, adicione `@testing-library/react` + `jsdom` só ao `apps/web`.
- Fluxos de tela: E2E em `apps/e2e` (seção abaixo).

### `apps/e2e`: fluxos de tela com Playwright

- Rode com `pnpm test:e2e` (precisa do `pnpm infra:up`). O [config](../../../apps/e2e/playwright.config.ts) sobe sozinho a API na porta 4100 (banco `cvpilot_test`, Redis de teste) e o web na 3100 (build em `.next-e2e`), num Chromium headless. O `pnpm dev` pode continuar rodando, e nenhum painel de navegador precisa estar aberto. Os workers não sobem.
- Sem o Chromium do Playwright instalado, `E2E_BROWSER_CHANNEL=chrome` (ou `msedge`) usa o navegador da máquina.
- **Conta:** use a fixture `account` de [fixtures.ts](../../../apps/e2e/support/fixtures.ts). Ela cadastra pela API, aceita os termos, deixa a página logada e exclui a conta no fim. Um fluxo que passa pelo cadastro na tela usa `newEmail()` e termina com `removeAccount` num `finally` (a exclusão pela API apaga também os arquivos no S3).
- **Cenário:** monte no banco com o `db` de [support/db.ts](../../../apps/e2e/support/db.ts) (ex.: `seedJobScenario`). O que um worker faria (ler o currículo, `apply`, `notify`) é simulado ali (`simulateResumeParsed`, `simulateAssistedApply`); os processors têm testes próprios. Dados fora da conta levam o prefixo `e2e-`, que o setup e o teardown limpam.
- **Seletores** por papel e nome acessível (`getByRole('button', { name })`, `getByLabel`), dentro do `dialog` do modal quando houver. Se o seletor por papel não acha o elemento, desconfie primeiro da acessibilidade da tela: foi assim que apareceu o "Sair" sem papel de botão.
- **Mantine:**
  - o rótulo de `Select`/`MultiSelect` nomeia o campo e a lista: use `getByRole('textbox', { name })`;
  - as opções abrem num portal: `page.getByRole('option', { name })`;
  - `getByLabel` casa por trecho: use `exact: true` quando um rótulo contém outro ("Resposta 1" × "Remover resposta 1").
- Depois da ação na tela, confira no banco o que a API gravou.
- Falhou? `test-results/<teste>/error-context.md` tem o snapshot da página, e `pnpm --filter @cv-pilot/e2e exec playwright show-trace <trace.zip>` mostra cada passo.

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
