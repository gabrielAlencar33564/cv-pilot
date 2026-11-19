# AGENTS.md — CV Pilot

Instruções para **qualquer agente de IA** neste repositório (Claude Code, Codex, Cursor, Copilot, Gemini CLI etc.). Este arquivo é a **fonte única das regras**; o `CLAUDE.md` só o importa. Ao mudar uma regra, mude aqui.

## Projeto em 30 segundos

Plataforma que ajuda o candidato a **encontrar vagas e ser contratado**:

1. O candidato cadastra perfis de busca e vários currículos, e escolhe qual currículo usar em cada site.
2. Bots coletam vagas, dão uma nota de compatibilidade e preparam candidaturas automáticas ou assistidas.
3. O candidato acompanha tudo num painel.

- Produto e requisitos: [docs/PRD.md](docs/PRD.md).
- Arquitetura atual e o quanto do PRD está feito: [docs/visao-geral.md](docs/visao-geral.md).
- **Bugs conhecidos e plano de ação: [docs/melhorias.md](docs/melhorias.md).** Antes de mexer numa área, veja se ela tem item aberto lá; ao resolver um item, marque-o.

Stack: TypeScript strict · pnpm workspaces + Turborepo · Next.js 15 + Mantine 8 + TanStack Query · Fastify 5 + Zod · Prisma + PostgreSQL 16/pgvector · BullMQ + Redis · S3 compatível (SeaweedFS) · Docker Compose + Caddy.

## Mapa do repositório

| Caminho              | O que vive ali                                                                                                   | Pode importar                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/web`           | Next.js (App Router). Telas em `src/app`, lógica por domínio em `src/features`, utilitários em `src/lib`         | `contracts`                                             |
| `apps/api`           | Fastify. Um módulo por domínio em `src/modules/<dominio>/` (`routes.ts`, `service.ts`); plugins em `src/plugins` | `contracts`, `core`, `db`, `queue`, `logger`, `storage` |
| `apps/workers`       | Processors BullMQ em `src/processors`, agendamento em `src/scheduler`                                            | todos os pacotes                                        |
| `packages/contracts` | Schemas Zod e tipos trafegados entre web, api e extensão                                                         | só `zod`                                                |
| `packages/core`      | Regras de negócio **puras** (sem I/O, sem framework)                                                             | `contracts`                                             |
| `packages/adapters`  | Um adapter por site de vagas                                                                                     | `contracts` (nunca `db` ou `queue`)                     |
| `packages/db`        | Schema Prisma, migrations, client e seed                                                                         | —                                                       |
| `packages/queue`     | Nomes das filas, payloads, conexão Redis                                                                         | —                                                       |
| `packages/ai`        | Interface `AiProvider` e implementações                                                                          | `contracts`                                             |
| `packages/logger`    | Logger pino compartilhado: formato, mascaramento de dados pessoais, contexto por job, falhas fatais              | —                                                       |
| `packages/storage`   | Arquivos de currículo no S3: chave do objeto e criptografia AES-256-GCM com `ENCRYPTION_KEY`                     | —                                                       |
| `infra/docker`       | Dockerfiles, compose de produção e dev, Caddyfile                                                                | —                                                       |

Dependências só apontam de `apps/*` para `packages/*`, nunca ao contrário. Um pacote não importa um app. O ESLint barra qualquer import fora da coluna "Pode importar"; ao mudar essa tabela, mude também os `limites(...)` do `eslint.config.mjs`.

## Comandos

```bash
pnpm install                          # dependências (use só pnpm, nunca npm/yarn)
pnpm infra:up                         # Postgres :5433, Redis :6380 e S3/SeaweedFS :8333 (dev)
pnpm db:generate                      # gera o Prisma Client (obrigatório num checkout novo)
pnpm db:migrate --name <descricao>    # cria e aplica uma migration em dev
pnpm db:deploy                        # só aplica as migrations pendentes
pnpm db:seed                          # fontes + usuário dev
pnpm dev                              # web :3000, api :4000, workers
pnpm typecheck                        # tsc em todos os pacotes
pnpm test                             # vitest nos pacotes que têm testes (unidade, sem banco)
pnpm test:integration                 # *.int.test.ts contra o Postgres de teste (precisa do pnpm infra:up)
pnpm --filter @cv-pilot/core test     # um pacote só
pnpm lint                             # ESLint: regras de código, promessas e limites entre pacotes
pnpm lint:fix                         # corrige o que for automático
pnpm knip                             # exports, arquivos e dependências sem uso
pnpm check                            # generate + typecheck + lint + knip + test (rode antes de concluir)
pnpm format                           # prettier (singleQuote, semi, trailingComma all, 100 col)
```

Os scripts `db:*` carregam o `.env` da raiz via `dotenv-cli`. Rodar `prisma` direto dentro de `packages/db` não encontra o `DATABASE_URL`.

Qualidade e código morto são checados em três camadas:

- o **compilador** (`noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`);
- o **ESLint** ([eslint.config.mjs](eslint.config.mjs)): `any`, promessas soltas, `console`, `.only`/`.skip` e imports fora dos limites entre pacotes;
- o **knip** ([knip.json](knip.json)): exports, arquivos e dependências sem uso.

Não silencie uma regra para passar: corrija o código. Exceção legítima leva `// eslint-disable-next-line <regra> -- motivo`. Um disable sem efeito também é erro.

## Skills

Procedimentos detalhados ficam em `.claude/skills/<nome>/SKILL.md` (formato aberto Agent Skills). Claude Code, Copilot e Cursor carregam essa pasta automaticamente. **Se o seu agente não carrega skills sozinho, leia o `SKILL.md` correspondente antes de começar a tarefa.** Uma tarefa pode usar mais de uma skill.

| Skill                                                      | Use quando for...                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`testes`](.claude/skills/testes/SKILL.md)                 | Escrever ou corrigir testes em qualquer pacote (vale para toda mudança de comportamento) |
| [`modulo-api`](.claude/skills/modulo-api/SKILL.md)         | Criar ou alterar rotas, serviços ou contratos Zod da API Fastify                         |
| [`banco-prisma`](.claude/skills/banco-prisma/SKILL.md)     | Mudar o `schema.prisma`, criar migrations, índices, pgvector ou seed                     |
| [`fila-worker`](.claude/skills/fila-worker/SKILL.md)       | Criar ou alterar filas BullMQ, processors, scheduler ou payloads                         |
| [`adapter-vagas`](.claude/skills/adapter-vagas/SKILL.md)   | Adicionar ou corrigir a integração com um site de vagas                                  |
| [`tela-web`](.claude/skills/tela-web/SKILL.md)             | Criar ou alterar telas, formulários ou hooks do Next.js/Mantine                          |
| [`integracao-ia`](.claude/skills/integracao-ia/SKILL.md)   | Implementar extração de CV, cartas, embeddings ou qualquer chamada a LLM                 |
| [`lgpd-seguranca`](.claude/skills/lgpd-seguranca/SKILL.md) | Mexer em dados pessoais, autenticação, upload, criptografia, logs ou exclusão de conta   |
| [`docker-infra`](.claude/skills/docker-infra/SKILL.md)     | Editar Dockerfile, compose, Caddy, `.dockerignore` ou scripts de infra                   |

## Regras de código

### Clean code

- **Siga o padrão que já existe** no arquivo e no módulo vizinho antes de inventar um novo.
- Nomes que dizem o que a coisa é: `resolveSendRule`, `jobDedupeHash`. Nada de `data2`, `tmp`, `handleStuff`.
- Funções pequenas e com uma responsabilidade. Prefira retorno antecipado a `if` aninhado.
- Regra de negócio vai para `packages/core` como função pura. Rotas e processors só orquestram: validam, buscam, chamam o core e gravam.
- Sem abstração especulativa: nada de interface, factory ou opção "para o futuro" sem um segundo uso real.
- Sem duplicação: antes de escrever um helper, procure um equivalente (CodeGraph ou busca no repo).
- Comentário explica **por quê**, não o quê. Código óbvio não leva comentário.
- Sem números mágicos: dê nome à constante (`const MAX_RESULTS = 200`).
- Arquivos focados. Se um arquivo passar de ~300 linhas ou misturar assuntos, divida.

### Código morto: tolerância zero

Ao terminar qualquer tarefa, o diff não pode deixar para trás:

- imports, variáveis, parâmetros, funções, tipos ou exports sem uso (prefixe com `_` só quando a assinatura exige o parâmetro, como `(_req, reply)`);
- arquivos órfãos, dependências sem uso em `package.json`, scripts ou variáveis de ambiente que nada lê;
- código comentado, `console.log`, `debugger`, flags e ramos que nunca executam.

Se você substituiu algo, **apague o antigo no mesmo diff**. `pnpm knip` aponta o que ficou sem uso. Antes de remover um export, confirme com CodeGraph ou `grep` no monorepo inteiro, incluindo `apps/`. Só exporte o que outro arquivo importa; tipos que compõem uma interface pública do mesmo arquivo (ex.: `AdapterContext` em `JobSourceAdapter`) podem ficar exportados.

### TypeScript

- `strict` está ligado e o tipo do domínio nasce em `packages/contracts` (`z.infer`). Não redefina à mão um tipo que já existe lá.
- Nada de `any`, `as unknown as`, `@ts-ignore` ou `!` para calar o compilador. Se for inevitável (tipagem de lib, por exemplo), use `@ts-expect-error` ou o cast com um comentário dizendo o porquê.
- Entrada externa (body, query, params, resposta de site, JSON do banco) é validada com Zod antes de usar.
- Imports de tipo com `import type` (exigido por `verbatimModuleSyntax`).

### Erros e logs

Os logs saem do pacote [`@cv-pilot/logger`](packages/logger/src/index.ts) (pino), usado pela API e pelos workers: JSON em produção, legível em dev, com dados pessoais mascarados.

- **API:** lance `HttpError(status, 'codigo_em_snake_case')` ([errors.ts](apps/api/src/plugins/errors.ts)). O `errorHandler` já registra os erros: 5xx como `error`, com stack; 4xx como `info`, só com o código. Erros Zod viram 400, e o log mostra só os caminhos dos campos. Dentro de uma rota, use `req.log` (já leva o `reqId`).
- **Workers:** use o `logger` de [apps/workers/src/logger.ts](apps/workers/src/logger.ts). Toda linha emitida durante um job já leva `queue`, `jobId` e `attempt`; não repita esses campos. Início (`debug`), fim com duração (`info`), falhas, jobs travados e erros do worker são registrados por [job-logging.ts](apps/workers/src/job-logging.ts). **Não logue e relance o mesmo erro no processor**: o evento `failed` já registra, com stack, a tentativa e se haverá outra. Use `UnrecoverableError` para falhas que não adianta repetir.
- **Erro sempre na chave `err`:** `logger.error({ err, sourceId }, 'mensagem')`. Assim ele sai com tipo, mensagem e stack.
- **Níveis:** `debug` para detalhe de depuração · `info` para eventos normais · `warn` para falha recuperável ou retentativa · `error` para o que precisa de atenção · `fatal` para quando o processo vai cair. Controle com `LOG_LEVEL`; `LOG_PRETTY` força o formato legível ou o JSON.
- **Nunca logue dados pessoais** (nome, e-mail, telefone, conteúdo de currículo, tokens). Logue ids. O mascaramento automático (`SENSITIVE_FIELDS` no `@cv-pilot/logger`) é a rede de proteção, não a regra: campo pessoal novo entra nessa lista.
- Não engula erro com `catch {}` vazio. Trate, relance ou registre com motivo.

### Idioma

- Identificadores, nomes de arquivos e códigos de erro em **inglês**.
- Comentários, textos de interface, mensagens de log, descrições de teste e documentação em **português do Brasil**.
- Commits em pt-BR, no imperativo, com prefixo [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Testes (obrigatório)

- **Toda mudança de comportamento vem com teste.** Um bug corrigido começa por um teste que reproduz o bug e falha.
- Testes ficam ao lado do código (`arquivo.test.ts`), com Vitest e `describe`/`it` em pt-BR.
- Prioridade: regras do `core` (unitário puro) → `normalize` dos adapters (fixture salva) → rotas da API (`app.inject`) → processors (com dependências falsas).
- Nunca enfraqueça ou apague um teste para fazê-lo passar. Nunca deixe `.only` ou `.skip` no código.
- Detalhes e modelos: skill [`testes`](.claude/skills/testes/SKILL.md).

## Domínio (glossário)

| Termo                             | Significado                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Perfil de busca (`SearchProfile`) | "O que estou buscando": palavras-chave, filtros, sites, frequência, limite diário e nota mínima para envio automático |
| Fonte (`Source`)                  | Um site de vagas cadastrado; corresponde a um adapter (`id` igual ao do adapter)                                      |
| Adapter                           | Código que busca e normaliza vagas de uma fonte e, opcionalmente, envia candidaturas                                  |
| Vaga (`Job`) + `JobSource`        | A vaga normalizada e deduplicada; `JobSource` guarda cada site onde ela apareceu                                      |
| Match (`JobMatch`)                | Nota de 0 a 100 de uma vaga para um perfil, com os motivos                                                            |
| Regra de envio (`SendRule`)       | Qual currículo, carta, tom e modo usar. Precedência: **perfil+site → site → perfil → padrão** (`resolveSendRule`)     |
| Modo de envio                     | `api`, `email` ou `assisted` (a extensão preenche e o candidato envia)                                                |
| Candidatura (`Application`)       | Status em `ApplicationStatus` (`contracts/enums.ts`). `needs_action` = "Ação necessária"                              |

## Regras inegociáveis do produto

1. **Nunca burlar** CAPTCHA, anti-bot, 2FA ou login de nenhum site. Diante de um bloqueio, o bot para e a candidatura vai para `needs_action`.
2. Respeitar termos de uso, `robots.txt` e limites de requisição; o bot sempre se identifica pelo User-Agent.
3. Toda consulta a dados do usuário é **filtrada por `userId`**. Nunca confie em id vindo do cliente sem checar o dono.
4. A IA **nunca inventa** experiência, curso, cargo ou resultado em cartas e currículos.
5. Envio automático só acima da nota mínima e dentro do limite diário; o padrão é revisar antes de enviar.

## Docker

Regras completas na skill [`docker-infra`](.claude/skills/docker-infra/SKILL.md). O essencial:

- Copiar só os manifests e o lockfile antes do `pnpm install`, com cache mount do store.
- Imagens multi-stage, rodando como usuário não root.
- No dia a dia, `pnpm infra:up` + `pnpm dev`. **Não rebuildar imagem para testar cada mudança.**

## Documentação

- Um requisito do PRD mudou de status → atualize a tabela de cobertura em `docs/visao-geral.md`.
- Resolveu um item de `docs/melhorias.md` → marque o checkbox e ajuste o texto.
- Decisão de arquitetura (escolher biblioteca, provedor, padrão) → crie `docs/adr/NNNN-titulo.md` (contexto, decisão, consequências).
- Novo site de vagas → crie `docs/fontes/<site>.md`.

## Limites para agentes

- Nunca faça commit de `.env` nem imprima segredos. Use e atualize o `.env.example`.
- Não edite uma migration já aplicada; crie outra.
- Não rode comandos destrutivos (`docker compose down -v`, `docker system prune`, `prisma migrate reset`, `git reset --hard`) sem pedir confirmação.
- Não adicione dependência sem necessidade clara. Prefira o que já está no monorepo e diga por que a nova é necessária.

## Definição de pronto

Antes de dizer que terminou:

- [ ] `pnpm check` passa (Prisma generate, typecheck, lint, knip e testes)
- [ ] Mexeu em rota da API, schema ou migration: `pnpm test:integration` também passa
- [ ] O comportamento novo ou corrigido tem teste
- [ ] Zero código morto no diff, inclusive o que as ferramentas não pegam: código comentado, ramos que nunca executam, variáveis de ambiente que nada lê
- [ ] Nenhum `any`, `@ts-ignore` ou cast novo sem justificativa
- [ ] Prettier aplicado nos arquivos alterados (`pnpm exec prettier --write <arquivos>`)
- [ ] Contratos, migrations, `.env.example` e docs atualizados quando a mudança pede
- [ ] O relato final diz o que **não** foi verificado (por exemplo: "não testei com o banco real")
