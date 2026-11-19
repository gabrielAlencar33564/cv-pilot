# Melhorias e próximos passos

> Análise feita em **2026-11-18** a partir do código atual e do [PRD](PRD.md). O retrato do que existe hoje está em [visao-geral.md](visao-geral.md).

**Como ler:**

- Prioridade: **P0** bloqueia o MVP ou o deploy · **P1** bug ou risco real · **P2** melhoria importante · **P3** acabamento.
- Esforço: **P** (horas) · **M** (alguns dias) · **G** (uma semana ou mais).

---

## 1. Problemas encontrados no código

| #   | Prior. | Problema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Onde                                                                                                                                                                       | Correção sugerida                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | ~~P0~~ | ~~**Corrida do Prisma no Turbo.**~~ **Resolvido:** `typecheck`, `test`, `build` e `dev` dependem de `["^generate", "generate"]`, e o `@cv-pilot/db` só checa os tipos depois de gerar o client. Antes, as duas tarefas rodavam em paralelo. No Prisma 6.19 o stub do postinstall exporta `PrismaClient: any`, então a corrida não quebrava o build: ela escondia erros de tipo no `db`. Conferido com `turbo --dry=json` e num clone limpo (`pnpm install` + `pnpm typecheck`, sem `db:generate`) | [turbo.json](../turbo.json)                                                                                                                                                | —                                                                    |
| 2   | ~~P0~~ | ~~**Não há migrations.**~~ **Resolvido:** a migration inicial `20261118000000_init` foi criada (com `CREATE EXTENSION vector`). Os ajustes dos itens 12 e 13 ficam para uma migration nova.                                                                                                                                                                                                                                                                                                       | [migrations/](../packages/db/prisma/migrations)                                                                                                                            | —                                                                    |
| 3   | ~~P0~~ | ~~**O pipeline nunca gera candidatura.**~~ **Resolvido:** `POST /resumes/:id/versions` recebe PDF ou DOCX (multipart, até 5 MB, validado pelo conteúdo), grava cifrado no S3, cria a `ResumeVersion` e enfileira o `resume-parse`, que extrai os dados com o Claude. A tela `/resumes` envia o arquivo e mostra o status da extração                                                                                                                                                              | [resumes/service.ts](../apps/api/src/modules/resumes/service.ts), [resume-parse.ts](../apps/workers/src/processors/resume-parse.ts)                                        | —                                                                    |
| 4   | ~~P1~~ | ~~**O dedupe junta vagas diferentes.**~~ **Resolvido:** a senioridade vira token canônico e fica na chave (`jr`/`junior` → `junior`, `pl`/`pleno` → `pleno`, `sr`/`senior` → `senior`; I, II e III ficam). Os hashes de vagas antigas mudaram: em dev, elas podem duplicar uma vez                                                                                                                                                                                                                | [dedupe.ts](../packages/core/src/dedupe.ts)                                                                                                                                | —                                                                    |
| 5   | ~~P1~~ | ~~**O limite diário não segura.**~~ **Resolvido:** contador atômico no Redis (`INCR` + TTL) com a chave `usuário:fonte:dia`, no fuso do usuário (`User.timezone`). A vaga é reservada quando a candidatura entra na fila automática, então o `needs_action` não sai da conta e não há corrida entre réplicas. O teto continua sendo o `dailyApplyLimit` do perfil que gerou o match                                                                                                               | [daily-limit.ts](../packages/queue/src/daily-limit.ts), [match.ts](../apps/workers/src/processors/match.ts)                                                                | —                                                                    |
| 6   | ~~P1~~ | ~~**Os limites por site valem por processo.**~~ **Resolvido:** o `createPoliteFetch` recebe a vez de cada host do worker, que usa `SET NX PX` no Redis: no máximo uma requisição por intervalo por host, somando todas as réplicas                                                                                                                                                                                                                                                                | [host-throttle.ts](../apps/workers/src/host-throttle.ts), [http.ts](../packages/adapters/src/http.ts)                                                                      | —                                                                    |
| 7   | ~~P1~~ | ~~**Sites que bloquearam o bot recebem retentativas.**~~ **Resolvido:** 403 vira `SourceBlockedError`, que pausa a fonte (`Source.active = false`) e não repete; 429 vira `SourceRateLimitedError`, e o job é adiado pelo `Retry-After` (15 min se o site não disser)                                                                                                                                                                                                                             | [search.ts](../apps/workers/src/processors/search.ts)                                                                                                                      | —                                                                    |
| 8   | ~~P1~~ | ~~**O bypass de login depende de `NODE_ENV`.**~~ **Resolvido:** a API tem login de verdade (e-mail e senha com Better Auth, sessão em cookie `httpOnly`, [ADR 0003](adr/0003-login-com-better-auth.md)). O cabeçalho `x-dev-user-id` e a flag `AUTH_DEV_BYPASS` saíram; em dev, o seed cria o usuário `dev@cvpilot.local` com a senha de `DEV_USER_PASSWORD`                                                                                                                                      | [auth.ts](../apps/api/src/plugins/auth.ts)                                                                                                                                 | —                                                                    |
| 9   | ~~P1~~ | ~~**O matching compara substrings.**~~ **Resolvido:** a nota compara termos inteiros, sem acentos e mantendo `c#`, `c++` e `node.js`; palavra-chave composta casa como frase. As regras rígidas agora cobrem senioridade, contrato, salário e local, além de modelo, empresa e termos excluídos. O filtro prévio dos adapters (`matchesKeywords`) ainda compara substrings: ele só traz candidatas, e a nota descarta os falsos positivos                                                         | [scoring.ts](../packages/core/src/scoring.ts)                                                                                                                              | —                                                                    |
| 10  | ~~P2~~ | ~~**O status da candidatura é livre.**~~ **Resolvido:** a máquina de estados do `core` (`manualTransitions`) diz para onde cada status pode ir à mão; o `PATCH` recusa o resto com 409 `invalid_status_transition`, nunca aceita `queued` e só aceita `sent` a partir de "Ação necessária". Cada mudança entra no `log` da candidatura                                                                                                                                                            | [application-status.ts](../packages/core/src/application-status.ts), [applications/service.ts](../apps/api/src/modules/applications/service.ts)                            | —                                                                    |
| 11  | ~~P2~~ | ~~**O kanban esconde 4 status.**~~ **Resolvido:** uma coluna por etapa do funil e "Encerradas" (recusada, sem resposta, falhou). O card troca o status pelo menu "Mover" (só as transições permitidas), guarda anotações e mostra a carta                                                                                                                                                                                                                                                         | [applications/page.tsx](../apps/web/src/app/applications/page.tsx)                                                                                                         | —                                                                    |
| 12  | ~~P2~~ | ~~**A unicidade da regra de envio com NULL**~~ **Resolvido:** a migration `embeddings_1024_and_search_indexes` recria o índice único com `NULLS NOT DISTINCT` (mesmo nome), e o serviço converte a violação (P2002) em 409. A checagem prévia continua, para responder antes de gravar                                                                                                                                                                                                            | [migration](../packages/db/prisma/migrations/20261118211445_embeddings_1024_and_search_indexes/migration.sql), [service.ts](../apps/api/src/modules/send-rules/service.ts) | —                                                                    |
| 13  | ~~P2~~ | ~~**`vector(1536)` está fixo**~~ **Resolvido:** modelo escolhido, Voyage `voyage-4`; as duas colunas passaram para `vector(1024)` na migration `embeddings_1024_and_search_indexes`, com índices HNSW parciais (`WHERE embedding IS NOT NULL`, para o Prisma não tentar derrubá-los)                                                                                                                                                                                                              | [schema.prisma](../packages/db/prisma/schema.prisma)                                                                                                                       | —                                                                    |
| 14  | P2     | **A vaga é sobrescrita pela última fonte** (por exemplo, uma descrição curta substitui uma completa), e `active: true` reativa vagas encerradas.                                                                                                                                                                                                                                                                                                                                                  | [search.ts:61-80](../apps/workers/src/processors/search.ts)                                                                                                                | Merge que prefere campos não nulos e mais completos                  |
| 15  | P2     | **A busca por perfil multiplica as requisições.** Greenhouse e Lever baixam **todos** os boards a cada job (perfil × fonte).                                                                                                                                                                                                                                                                                                                                                                      | [greenhouse/index.ts:31-33](../packages/adapters/src/greenhouse/index.ts), [tick.ts](../apps/workers/src/scheduler/tick.ts)                                                | Ver §2.1                                                             |
| 16  | P2     | **`sourceIds` do perfil não é validado.** Um perfil que aponta para uma fonte inexistente nunca é buscado, e ninguém avisa.                                                                                                                                                                                                                                                                                                                                                                       | [search-profile.ts:18](../packages/contracts/src/search-profile.ts)                                                                                                        | Validar contra `Source` na API                                       |
| 17  | P2     | **Falha de job só aparece no log.** Os logs já são completos: contexto por job, stack, tentativa e se haverá retentativa ([job-logging.ts](../apps/workers/src/job-logging.ts)). Mas não há alerta nem tela de falhas.                                                                                                                                                                                                                                                                            | [job-logging.ts](../apps/workers/src/job-logging.ts)                                                                                                                       | Bull Board no admin + alerta quando a taxa de erro de uma fonte sobe |
| 18  | ~~P3~~ | ~~**Configuração.**~~ **Resolvido:** a `ENCRYPTION_KEY` cifra os currículos no S3 ([ADR 0002](adr/0002-criptografia-de-curriculos.md)); o entrypoint do SeaweedFS cria o bucket `resumes`; a identidade das apps só tem `Read`, `Write` e `List` nesse bucket; e o `queue` exige `REDIS_URL`                                                                                                                                                                                                      | [storage](../packages/storage/src), [s3-entrypoint.sh](../infra/docker/seaweedfs/s3-entrypoint.sh)                                                                         | —                                                                    |
| 19  | P3     | **O `web` duplica tipos** que já existem nos contratos.                                                                                                                                                                                                                                                                                                                                                                                                                                           | [types.ts](../apps/web/src/lib/types.ts)                                                                                                                                   | Schemas de resposta em `contracts` + `z.infer`                       |

---

## 2. Melhorias técnicas

### 2.1 Coleta: ingerir uma vez e comparar com todos os perfis

Hoje o scheduler cria um job `search` por **perfil × fonte**. Com 1.000 usuários e 2 perfis cada, os mesmos boards do Greenhouse e do Lever seriam baixados 2.000 vezes a cada janela. É desperdício e passa uma imagem ruim para os sites.

Proposta:

1. **Catálogo de empresas.** Nova tabela `CareerBoard (sourceId, token, empresa, ativo, lastFetchedAt, etag)` no lugar de `Source.config.boards`. Ela pode crescer com sugestões dos usuários (§3, item "Adicionar empresa").
2. **Fila `ingest`.** Um job por board, ou por consulta normalizada no caso de fontes de busca como a Gupy, com deduplicação global: se dez usuários buscam "react", a consulta é feita uma vez.
3. **Match pela vaga.** Cada vaga nova ou alterada dispara `match`, que pré-filtra no SQL os perfis candidatos (fonte, regras rígidas, FTS) e calcula a nota só para eles.
4. ~~**Rate limit global** por host no Redis (item 6 da tabela)~~ feito. Falta respeitar o `robots.txt` (RNF-06).
5. **Expiração (RF-34).** Uma vaga que não aparece numa ingestão por X dias, ou cujo `isStillOpen` dá falso, fica `active = false`.

### 2.2 Matching em camadas

1. **Filtro rígido + texto.** Blacklist, exclusões, modelo de trabalho, senioridade, contrato, salário e local. Busca textual com `tsvector` (`portuguese`) e índice GIN.
2. **Similaridade semântica.** Embedding do currículo (por versão) × embedding da vaga, com pgvector (`<=>`, índice HNSW).
3. **Explicação (RF-41).** Para as N melhores vagas, gerar "habilidades em comum" e "o que falta" a partir de `ResumeVersion.parsed` × requisitos da vaga. Um reranker (ex.: Voyage `rerank-3`) é opcional.
4. **Calibração.** Ajustar os pesos com o feedback real: "não tenho interesse", candidaturas e respostas das empresas.

### 2.3 IA (questão em aberto nº 2 do PRD)

| Tarefa                        | Recomendação                                                                                                                                                                  | Observações                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extrair dados do CV (RF-21)   | Claude (`claude-opus-5-5`) com o PDF enviado direto (bloco `document`, até 32 MB / 600 páginas) e **saída estruturada** (`output_config.format` ou `client.messages.parse()`) | Dá para reaproveitar o schema Zod de `ParsedResume`. DOCX: converter para texto antes (ex.: `mammoth`). Uma extração por versão, como já diz o PRD |
| Carta de apresentação (RF-54) | Claude, com o tom da regra e em pt-BR                                                                                                                                         | Regra explícita no prompt: **nunca inventar experiência**. Usar prompt caching no system prompt                                                    |
| Embeddings (RF-40)            | A Anthropic **não tem** modelo de embeddings; a documentação dela recomenda o **Voyage AI** (`voyage-4` ou `voyage-4-lite`, multilíngues, 1024 dimensões por padrão)          | `voyage-4-nano` tem pesos abertos e pode rodar na própria VM. As colunas já estão em `vector(1024)` (item 13)                                      |
| Custo                         | Montar um pequeno conjunto de CVs e vagas reais e medir se modelos menores (Sonnet 5.5, Haiku 5.5) mantêm a qualidade antes de trocar                                         | Reprocessamentos em massa podem usar a Batches API (50% mais barata). Cachear embeddings por hash do texto                                         |
| Implementação                 | SDK oficial `@anthropic-ai/sdk`, implementando `AiProvider`                                                                                                                   | Tratar `stop_reason` (`refusal`, `max_tokens`) e registrar o uso de tokens por usuário (prepara planos e limites)                                  |

> **LGPD:** enviar o currículo a um provedor de IA é compartilhamento de dados pessoais e pode ser transferência internacional. Declare isso na política de privacidade e no consentimento (RF-03), e envie só o necessário: nada de CPF ou documentos.

### 2.4 Autenticação (RF-01)

- ~~Escolher entre Auth.js e Better Auth~~ feito: **Better Auth**, montado na API em `/auth`, com sessões no Postgres e cookie `httpOnly` ([ADR 0003](adr/0003-login-com-better-auth.md)).
- ~~`ConsentLog` no cadastro e rotas de exportar e excluir conta (RF-03, RF-04)~~ feito: o aceite grava versão, data e IP; quando `TERMS_VERSION` muda, a API responde 403 `consent_required` até o novo aceite. A exportação sai em `/me/export`; a exclusão pede a senha e apaga os arquivos no S3 antes das linhas.
- Falta, quando houver envio de e-mail: verificação do e-mail no cadastro e "esqueci a senha". Até lá, a senha muda na página da conta.
- Os termos e a política v1 ([/termos](../apps/web/src/app/termos/page.tsx)) são um **rascunho**: precisam de revisão jurídica antes de usuários reais.

### 2.5 Segurança e LGPD

- `@fastify/rate-limit` em toda a API, com limites mais baixos em login e upload.
- ~~Upload: `@fastify/multipart` com limite de tamanho, validação pelo conteúdo e nome de arquivo gerado no servidor~~ feito (item 3).
- Downloads de currículo: como o arquivo é cifrado na aplicação, uma URL pré-assinada entregaria só a cifra. A pré-visualização (RF-24) deve servir o arquivo decifrado pela API, depois de conferir o dono ([ADR 0002](adr/0002-criptografia-de-curriculos.md)).
- Criptografia em repouso (RNF-05): ~~currículos com AES-GCM na aplicação~~ feito ([ADR 0002](adr/0002-criptografia-de-curriculos.md)). Falta usar a mesma primitiva nos tokens OAuth.
- ~~Exclusão de conta que apaga também os arquivos no S3~~ feito (imediata, com a senha). Falta um processor `cleanup` para a retenção configurável.
- O `redact` do pino deve cobrir campos do corpo (e-mail, telefone), além dos headers.
- **Storage:** o MinIO foi substituído pelo SeaweedFS (gateway S3). ~~Faltam healthcheck, criação do bucket e identidade com permissões mínimas~~ feito: o entrypoint cria o bucket, a identidade só lê, grava e lista `resumes`, e o healthcheck só fica verde com o gateway respondendo e o bucket criado. API e workers esperam o `s3` saudável no compose de produção.

### 2.6 Modelo de dados

- `ApplicationEvent` (tabela) no lugar de `Application.log` em JSON. Permite timeline, métricas (RF-63) e consultas por evento.
- Enums no Prisma (ou `CHECK`) para `status`, `mode`, `tone` e `kind`, alinhados aos enums dos contratos.
- `User.timezone` e preferências de notificação.
- ~~`JobMatch.dismissedReason`: o feedback que alimenta os filtros (RF-42)~~ feito; falta usá-lo na calibração (§2.2).
- `CareerBoard` (§2.1), `SourceRun` (histórico de execuções para o admin, RF-80) e `FormQuestion`/`SavedAnswer` (banco de respostas, §3).
- `Plan` e `UsageCounter`, para deixar a monetização preparada, como pede o PRD.
- Índices: ~~GIN em `tsvector(title, description)`, HNSW nos embeddings~~ feitos (item 13). Falta `Job(active, updatedAt)`.

### 2.7 Qualidade e DX

- ~~`git init` e o primeiro commit~~ feito.
- ~~ESLint + knip~~ feito: `pnpm lint` ([eslint.config.mjs](../eslint.config.mjs)), `pnpm knip` ([knip.json](../knip.json)) e `pnpm check`, que roda tudo.
- CI (GitHub Actions): ~~`pnpm install` com cache → `pnpm check`~~ feito em [ci.yml](../.github/workflows/ci.yml). Falta `pnpm build`.
- ~~`pnpm lint` precisa de mais de 2 GB de memória~~ feito: o ESLint com tipos num processo só carregava todos os projetos TypeScript e caía com "heap out of memory" no limite padrão de ~2 GB do Node (runner da CI, máquina com 8 GB de RAM). Agora o lint roda por pacote pelo Turbo, com cache, e nenhum processo passa de 512 MB.
- Testes:
  - ~~API com `app.inject()` e Postgres real~~ feito: `pnpm test:integration`, também na CI;
  - ~~testes de contrato com fixtures para Greenhouse e Lever~~ feito;
  - um teste de pipeline (search → match → application) com adapter falso;
  - ~~e2e com Playwright nos fluxos críticos~~ feito: `pnpm test:e2e` ([apps/e2e](../apps/e2e)), com API e web próprios contra o banco de teste. ~~Rodar na CI~~ feito: job `e2e` do [ci.yml](../.github/workflows/ci.yml), com o compose de dev (Postgres, Redis e SeaweedFS), o Chromium em cache e os resultados do Playwright como artifact quando falha.
- Renovate ou Dependabot.
- Opcional: compilar API e workers para JS (`tsup`/esbuild) em vez de rodar `tsx` em produção. A inicialização fica mais rápida e a imagem não precisa do `tsx`.

### 2.8 Infra e operação

- Healthcheck nos workers: heartbeat ou um `/health` mínimo.
- Bull Board em `/admin/queues`, protegido pelo papel `ADMIN` (RF-80/81: ver falhas e reexecutar).
- `infra/scripts`: `pg_dump` diário + espelho do bucket para um storage externo, **com teste de restauração**.
- Rastreamento de erros (Sentry ou GlitchTip) e métricas por adapter (vagas coletadas, erros, latência).
- `workers-browser` (Playwright) só quando existir um adapter `kind: "browser"`.

---

## 3. Funcionalidades novas

O objetivo do produto é **facilitar a busca e aumentar a chance de contratação**. As ideias abaixo complementam o PRD.

### 3.1 Encontrar vagas melhores, com menos esforço

| Funcionalidade                                                                                                                                                   | Por que ajuda                                                                                                   | Esforço       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- |
| **Onboarding a partir do CV:** o usuário sobe o currículo, a IA extrai os dados e **sugere perfis de busca prontos** (cargo, senioridade, palavras-chave, sites) | Tira o atrito do primeiro uso. O usuário vê vagas no primeiro dia                                               | M             |
| **Salvar vaga de qualquer site** (botão na extensão ou colar a URL)                                                                                              | Cobre LinkedIn, Indeed etc. **sem scraping**, porque é o próprio usuário navegando. A vaga entra no mesmo funil | M             |
| **Adicionar empresa:** o usuário cola a página de carreiras, o sistema detecta o ATS (Greenhouse, Lever, Ashby, Gupy...) e inclui no catálogo                    | O catálogo cresce sozinho e beneficia todos os usuários                                                         | P/M           |
| **Mais ATS com API pública de vagas:** Ashby, SmartRecruiters, Workable, Recruitee (além dos citados no PRD)                                                     | Mais vagas com baixo risco jurídico. Confirmar termos e formato de cada um                                      | P por adapter |
| **"O que falta" por vaga** + agregado: "aprender X abriria +N vagas compatíveis"                                                                                 | Transforma rejeição em plano de desenvolvimento                                                                 | M             |
| **Alertas por Telegram ou push** (WhatsApp depois, porque a API tem custo)                                                                                       | Vagas boas fecham rápido                                                                                        | P/M           |

### 3.2 Candidaturas que chamam atenção

| Funcionalidade                                                                                                                                    | Por que ajuda                                                                                         | Esforço |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| **Ajuste do CV por vaga:** sugestões de palavras-chave do ATS e reordenação de experiências. O usuário aprova e vira uma `ResumeVersion` derivada | Passa nos filtros dos ATS. **Nunca inventar experiência**, só reorganizar e enfatizar o que é verdade | M/G     |
| **Nota de aderência ao ATS:** quantos requisitos da vaga aparecem no CV                                                                           | Mostra por que o CV pode ser filtrado antes de enviar                                                 | P/M     |
| **Banco de respostas:** cada pergunta nova de formulário (capturada pela extensão) é respondida uma vez e reaproveitada                           | É o que mais consome tempo no modo assistido                                                          | M       |
| **Pré-visualização obrigatória no automático** nas primeiras N candidaturas de cada regra                                                         | Dá confiança antes de liberar o piloto automático                                                     | P       |

### 3.3 Do envio à contratação

| Funcionalidade                                                                                                       | Por que ajuda                                                           | Esforço |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| **Atualização rápida de status:** botões no card ("recebi resposta", "entrevista", "recusada") e no e-mail de resumo | Sem isso as métricas do RF-63 não existem                               | P       |
| **Lembretes de follow-up:** após X dias sem resposta, sugere uma mensagem pronta                                     | Follow-ups educados aumentam as respostas                               | P/M     |
| **Preparação para entrevista:** perguntas prováveis a partir da vaga + respostas no formato STAR baseadas no CV      | Ajuda na etapa que decide a contratação                                 | M       |
| **Agenda de entrevistas:** convite `.ics` ou Google Calendar, com lembrete na véspera                                | Organização em processos paralelos                                      | P/M     |
| **Métricas e funil:** taxa de resposta e de entrevista por currículo × site × perfil (RF-63)                         | É o diferencial do produto: mostra qual currículo funciona em qual site | M       |
| **Faixas salariais do mercado** agregadas das vagas coletadas, por cargo, senioridade e local                        | Ajuda a definir a pretensão e a negociar a oferta                       | M       |

---

## 4. Riscos de produto e conformidade

- **Volume e spam.** Manter `reviewBeforeSend = true` como padrão (já é) e os limites diários reais (item 5). Um candidato que envia 200 candidaturas genéricas prejudica a própria reputação.
- **Termos de uso.** Confirmar por escrito os termos da API da Gupy antes de produção (o próprio adapter avisa) e registrar, por fonte, a base de uso (API pública, termos, `robots.txt`) em `docs/fontes/<site>.md`.
- **Gmail/Outlook (RF-50, modo e-mail).** Os escopos do Gmail exigem verificação do app pelo Google, e os de **leitura** da caixa são classificados como restritos, com avaliação de segurança anual paga. Comece só com envio. A leitura automática de respostas pode esperar.
- **IA honesta.** Cartas e ajustes de CV nunca podem criar experiências, cursos ou resultados. Mostrar sempre o que foi alterado.
- **Viés.** O matching não deve usar idade, gênero, foto ou endereço exato como critério.

---

## 5. Plano de ação sugerido

Etapas em ordem; cada uma deixa o sistema mais utilizável que a anterior.

### Etapa 0 — Higiene (P)

- [x] `git init` + primeiro commit (com `.gitattributes` fixando LF)
- [x] Corrigir o `generate` no `turbo.json` (item 1)
- [x] Escolher o modelo de embeddings e ajustar `vector(...)` (item 13): Voyage `voyage-4`, `vector(1024)`
- [x] Migration inicial versionada (item 2)
- [x] Migration com `NULLS NOT DISTINCT`, HNSW e GIN (item 12)
- [x] Regras para agentes ([AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md)) e skills do projeto (`.claude/skills/`)
- [x] Flags do compilador contra código morto (`noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `noFallthroughCasesInSwitch`)
- [x] ESLint (type-aware, com limites entre pacotes) + knip, reunidos em `pnpm check`
- [x] CI rodando `pnpm check` ([ci.yml](../.github/workflows/ci.yml)): o primeiro run no GitHub, em 2026-11-18, passou
- [x] Criação automática do bucket e identidade S3 com permissões mínimas (item 18)

### Etapa 1 — Desbloquear o pipeline (M)

- [x] Upload de CV → S3 → `ResumeVersion` → `resume-parse` (item 3)
- [x] `AiProvider` real (extração estruturada, [ADR 0001](adr/0001-provedor-de-ia-claude.md))
- [x] Corrigir dedupe, limite diário, scoring, 403/429 e rate limit global (itens 4–9)
- [x] Testes de contrato do Greenhouse e do Lever + testes da API

### Etapa 2 — MVP para usuários reais (M/G)

- [x] Login + consentimento + exportar e excluir conta; remover o bypass implícito (item 8)
- [x] Ações na lista de vagas: detalhes, **candidatar**, **não tenho interesse**, pré-visualizar (RF-24, RF-42)
- [x] Kanban completo com troca de status e notas (itens 10 e 11)
- [x] Formulários completos: contrato, salário, blacklist, frequência, respostas padrão e modelos de carta
- [x] Alertas no app (`/alertas`): resumo diário de vagas novas às 8h no fuso do usuário, "ação necessária" e falha na leitura do currículo
- [ ] Notificações por **e-mail**: adiadas a pedido. Quando entrarem, viram mais um canal lendo os mesmos eventos do `notify`, junto com a verificação do e-mail e o "esqueci a senha"
- [x] Onboarding a partir do CV (perfis sugeridos por regras no `core`, sem chamada extra de IA)

### Etapa 3 — Escala e matching semântico (G)

- [ ] Ingestão desacoplada + catálogo de empresas + detector de ATS (§2.1)
- [ ] Embeddings + pgvector + "o que falta" (§2.2)
- [ ] Expiração de vagas, `robots.txt`, admin com Bull Board e `SourceRun`
- [ ] Novos adapters

### Etapa 4 — Automação e diferenciais (G)

- [ ] Extensão Chrome (modo assistido) + banco de respostas + salvar vaga de qualquer site
- [ ] Cartas por IA e ajuste de CV por vaga
- [ ] Métricas por currículo × site, follow-ups, preparação para entrevista
- [ ] Envio por e-mail via OAuth (depois da verificação do Google)
