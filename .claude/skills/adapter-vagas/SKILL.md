---
name: adapter-vagas
description: Adiciona ou corrige um adapter de site de vagas do CV Pilot (packages/adapters). Cobre busca, normalização para NormalizedJob, paginação, rate limit, fixtures e teste de contrato, registro, cadastro da fonte e o checklist de conformidade (termos de uso, robots.txt, nunca burlar CAPTCHA). Use ao integrar um novo site ou ATS (Gupy, Greenhouse, Lever, Ashby, Workable, SmartRecruiters...), quando um site mudar o formato da resposta ou quando um adapter começar a falhar.
---

# Adapters de sites de vagas

Contrato: [types.ts](../../../packages/adapters/src/types.ts) (`JobSourceAdapter`). Exemplos: [gupy](../../../packages/adapters/src/gupy/index.ts) (busca por palavra-chave, paginada), [greenhouse](../../../packages/adapters/src/greenhouse/index.ts) e [lever](../../../packages/adapters/src/lever/index.ts) (por empresa, via `Source.config`).

## 1. Conformidade, antes de escrever código

- Procure uma **API pública** ou um JSON público de vagas. Ordem de preferência para o `kind`: `api` → `html` (Cheerio, só se os termos permitirem) → `browser` (Playwright, último recurso).
- Leia os **termos de uso** e o **`robots.txt`**. Se o site proíbe automação (ex.: LinkedIn, Indeed), **não colete**: esse site só entra pelo modo assistido ou pela extensão.
- **Proibido:** burlar CAPTCHA, login, 2FA ou anti-bot; trocar User-Agent ou IP para escapar de bloqueio; navegador "stealth".
- Registre tudo em `docs/fontes/<site>.md`: URL base, tipo, link dos termos com a data da consulta, o que o `robots.txt` diz, rate limit adotado, modos de envio e particularidades.

## 2. Implementação

1. Crie `packages/adapters/src/<site>/index.ts` com a interface `<Site>RawJob` (só os campos usados) e `export const <site>Adapter: JobSourceAdapter<<Site>RawJob>`.
2. **`search(query, ctx)`** é um `async *` gerador:
   - faça requisições **só via `ctx.http`** (o fetch educado, com User-Agent, timeout e intervalo). Nunca use o `fetch` global;
   - pagine e pare em `ctx.maxResults`; não repita o mesmo id dentro de uma execução;
   - se a API não filtra por palavra-chave, use `matchesKeywords` de `../http`;
   - configuração por empresa vem de `ctx.config` (`Source.config`). Valide com um schema Zod; para isso, adicione `zod` às dependências do pacote.
3. **`normalize(raw)`** é função pura e retorna `NormalizedJob`:
   - `sourceId` = id do adapter; `externalId` estável e único dentro da fonte (com prefixo da empresa quando o id é por empresa, como `${board}:${id}` no Greenhouse);
   - `url` absoluta; `description` em texto puro (`htmlToText`);
   - `workModel`, `seniority` e `contractType` só com valores dos enums de `contracts`. **Na dúvida, `null`**: não chute;
   - datas como `Date`; salário em número ou `null`.
4. **`apply`**: só com API oficial de candidatura. Caso contrário, `modes: ['assisted']` retornando `needs_action`, como os adapters atuais.
5. Registre no array de [registry.ts](../../../packages/adapters/src/registry.ts).
6. Cadastre a fonte em `sources` no [seed.ts](../../../packages/db/src/seed.ts) (`id` igual ao do adapter, `kind`, `applyModes`, `active`).

## 3. Testes de contrato (obrigatórios)

- Fixture em `src/<site>/fixtures/<caso>.json`: uma resposta real, reduzida e **sem dados pessoais**. Inclua um caso com os campos opcionais ausentes.
- `src/<site>/<site>.test.ts`:
  - `normalize` mapeia os campos esperados e o resultado passa em `NormalizedJob.parse`;
  - `search` com `ctx.http` falso: pagina, respeita `maxResults` e não repete ids;
  - a configuração inválida ou vazia gera log, não crash.
- Modelos: [greenhouse.test.ts](../../../packages/adapters/src/greenhouse/greenhouse.test.ts) e [lever.test.ts](../../../packages/adapters/src/lever/lever.test.ts), com fixtures reais reduzidas; veja também a skill `testes`.

## Quando o site muda o formato

1. Capture a resposta nova e atualize ou acrescente a fixture.
2. Veja o teste falhar.
3. Ajuste `RawJob` e `normalize`.
4. Veja o teste passar. Mantenha a fixture antiga se os dois formatos convivem.

## Erros e bloqueios

- O `politeFetch` lança `SourceBlockedError` no 403, `SourceRateLimitedError` (com o `Retry-After`) no 429 e `Error` comum nos demais HTTP não-OK. **Não capture no adapter:** quem decide é o processor `search`, que pausa a fonte no 403 e adia o job no 429.
- O intervalo entre requisições ao mesmo host vem do worker (`createHostThrottle`, no Redis) e vale para todas as réplicas juntas. O adapter não controla tempo nem dorme.

## Checklist

- [ ] Termos e `robots.txt` verificados e registrados em `docs/fontes/<site>.md`
- [ ] Só `ctx.http`; paginação com limite; sem ids repetidos
- [ ] `normalize` puro, sem chutes, válido no `NormalizedJob`
- [ ] Fixtures sem dados pessoais + testes de contrato passando
- [ ] Registrado no `registry.ts` e no seed
- [ ] `docs/visao-geral.md` atualizado (lista de adapters)
