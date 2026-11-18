# Melhorias e próximos passos

> Análise feita em **2026-11-18** a partir do código atual e do [PRD](PRD.md). O retrato do que existe hoje está em [visao-geral.md](visao-geral.md).

**Como ler:**

- Prioridade: **P0** bloqueia o MVP ou o deploy · **P1** bug ou risco real · **P2** melhoria importante · **P3** acabamento.
- Esforço: **P** (horas) · **M** (alguns dias) · **G** (uma semana ou mais).

---

## 1. Problemas encontrados no código

| #   | Prior. | Problema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Onde                                                                                                                                                                       | Correção sugerida                                                                                                |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | ~~P0~~ | ~~**Corrida do Prisma no Turbo.**~~ **Resolvido:** `typecheck`, `test`, `build` e `dev` dependem de `["^generate", "generate"]`, e o `@cv-pilot/db` só checa os tipos depois de gerar o client. Antes, as duas tarefas rodavam em paralelo. No Prisma 6.19 o stub do postinstall exporta `PrismaClient: any`, então a corrida não quebrava o build: ela escondia erros de tipo no `db`. Conferido com `turbo --dry=json` e num clone limpo (`pnpm install` + `pnpm typecheck`, sem `db:generate`) | [turbo.json](../turbo.json)                                                                                                                                                | —                                                                                                                |
| 2   | ~~P0~~ | ~~**Não há migrations.**~~ **Resolvido:** a migration inicial `20261118000000_init` foi criada (com `CREATE EXTENSION vector`). Os ajustes dos itens 12 e 13 ficam para uma migration nova.                                                                                                                                                                                                                                                                                                       | [migrations/](../packages/db/prisma/migrations)                                                                                                                            | —                                                                                                                |
| 3   | P0     | **O pipeline nunca gera candidatura.** Nenhuma rota cria `ResumeVersion`, então o match sempre para em "currículo sem arquivo".                                                                                                                                                                                                                                                                                                                                                                   | [match.ts:42-46](../apps/workers/src/processors/match.ts), [resumes/routes.ts:20](../apps/api/src/modules/resumes/routes.ts)                                               | Upload multipart → S3 → `ResumeVersion` → enfileirar `resume-parse`                                              |
| 4   | P1     | **O dedupe junta vagas diferentes.** A normalização **remove** jr/pleno/sênior do título, então "Dev Jr" e "Dev Sr" da mesma empresa e cidade geram o mesmo hash. O segundo upsert sobrescreve o primeiro.                                                                                                                                                                                                                                                                                        | [dedupe.ts:8](../packages/core/src/dedupe.ts), [search.ts:75-80](../apps/workers/src/processors/search.ts)                                                                 | Trocar por um token canônico (`jr`→`junior`) e mantê-lo na chave. Adicionar testes de colisão                    |
| 5   | P1     | **O limite diário não segura.** A contagem considera só `queued/sent` do perfil, mas o `apply` muda o status para `needs_action`, que sai da conta. Além disso: há corrida entre jobs concorrentes, o limite é por perfil (o RF-51 pede por usuário e por fonte) e o "dia" usa o fuso do servidor (UTC no container).                                                                                                                                                                             | [match.ts:48-53](../apps/workers/src/processors/match.ts), [apply.ts:21-31](../apps/workers/src/processors/apply.ts)                                                       | Contador atômico no Redis (`INCR` com TTL, chave `usuário:fonte:data`) no fuso do usuário                        |
| 6   | P1     | **Os limites por site valem por processo, não para o sistema todo.** `lastCallByHost` fica em memória: com 3 réplicas, cada site recebe 3× mais requisições.                                                                                                                                                                                                                                                                                                                                      | [http.ts:2](../packages/adapters/src/http.ts)                                                                                                                              | Rate limit no Redis (token bucket por host) ou o rate limiter do BullMQ                                          |
| 7   | P1     | **Sites que bloquearam o bot recebem retentativas.** 403/429 viram um `Error` comum, e o BullMQ repete 4 vezes.                                                                                                                                                                                                                                                                                                                                                                                   | [http.ts:20-22](../packages/adapters/src/http.ts), [queue/index.ts:25-30](../packages/queue/src/index.ts)                                                                  | 403 → `UnrecoverableError` + alerta/pausa da fonte; 429 → respeitar `Retry-After`                                |
| 8   | P1     | **O bypass de login depende de `NODE_ENV`.** Qualquer ambiente sem `NODE_ENV=production` (staging, uma variável esquecida) aceita `x-dev-user-id`, e qualquer um pode se passar por qualquer usuário.                                                                                                                                                                                                                                                                                             | [auth.ts:22-26](../apps/api/src/plugins/auth.ts)                                                                                                                           | Flag explícita `AUTH_DEV_BYPASS=true`, e o servidor recusa subir com ela em produção                             |
| 9   | P1     | **O matching compara substrings.** `includes` faz "java" casar com "javascript", "go" com "algoritmo" e "react" com "reactive". As regras rígidas ignoram senioridade, contrato, salário e local, embora o perfil tenha esses campos.                                                                                                                                                                                                                                                             | [scoring.ts:9-35](../packages/core/src/scoring.ts)                                                                                                                         | Tokenizar com limite de palavra e sem acentos, ou usar FTS `portuguese` do Postgres. Completar as regras rígidas |
| 10  | P2     | **O status da candidatura é livre.** O `PATCH` aceita qualquer status, inclusive `queued` (sem enfileirar) e `sent`.                                                                                                                                                                                                                                                                                                                                                                              | [applications/routes.ts:23-31](../apps/api/src/modules/applications/routes.ts)                                                                                             | Máquina de estados no `core`, com as transições manuais permitidas                                               |
| 11  | P2     | **O kanban esconde 4 status.** Só 6 de 10 viram coluna; `in_process`, `rejected`, `no_response` e `failed` somem da tela.                                                                                                                                                                                                                                                                                                                                                                         | [applications/page.tsx:9](../apps/web/src/app/applications/page.tsx)                                                                                                       | Colunas para todos, ou um agrupamento "Encerradas"                                                               |
| 12  | ~~P2~~ | ~~**A unicidade da regra de envio com NULL**~~ **Resolvido:** a migration `embeddings_1024_and_search_indexes` recria o índice único com `NULLS NOT DISTINCT` (mesmo nome), e o serviço converte a violação (P2002) em 409. A checagem prévia continua, para responder antes de gravar                                                                                                                                                                                                            | [migration](../packages/db/prisma/migrations/20261118211445_embeddings_1024_and_search_indexes/migration.sql), [service.ts](../apps/api/src/modules/send-rules/service.ts) | —                                                                                                                |
| 13  | ~~P2~~ | ~~**`vector(1536)` está fixo**~~ **Resolvido:** modelo escolhido, Voyage `voyage-4`; as duas colunas passaram para `vector(1024)` na migration `embeddings_1024_and_search_indexes`, com índices HNSW parciais (`WHERE embedding IS NOT NULL`, para o Prisma não tentar derrubá-los)                                                                                                                                                                                                              | [schema.prisma](../packages/db/prisma/schema.prisma)                                                                                                                       | —                                                                                                                |
| 14  | P2     | **A vaga é sobrescrita pela última fonte** (por exemplo, uma descrição curta substitui uma completa), e `active: true` reativa vagas encerradas.                                                                                                                                                                                                                                                                                                                                                  | [search.ts:61-80](../apps/workers/src/processors/search.ts)                                                                                                                | Merge que prefere campos não nulos e mais completos                                                              |
| 15  | P2     | **A busca por perfil multiplica as requisições.** Greenhouse e Lever baixam **todos** os boards a cada job (perfil × fonte).                                                                                                                                                                                                                                                                                                                                                                      | [greenhouse/index.ts:31-33](../packages/adapters/src/greenhouse/index.ts), [tick.ts](../apps/workers/src/scheduler/tick.ts)                                                | Ver §2.1                                                                                                         |
| 16  | P2     | **`sourceIds` do perfil não é validado.** Um perfil que aponta para uma fonte inexistente nunca é buscado, e ninguém avisa.                                                                                                                                                                                                                                                                                                                                                                       | [search-profile.ts:18](../packages/contracts/src/search-profile.ts)                                                                                                        | Validar contra `Source` na API                                                                                   |
| 17  | P2     | **Falha de job só aparece no log.** Os logs já são completos: contexto por job, stack, tentativa e se haverá retentativa ([job-logging.ts](../apps/workers/src/job-logging.ts)). Mas não há alerta nem tela de falhas.                                                                                                                                                                                                                                                                            | [job-logging.ts](../apps/workers/src/job-logging.ts)                                                                                                                       | Bull Board no admin + alerta quando a taxa de erro de uma fonte sobe                                             |
| 18  | P3     | **Configuração.** `ENCRYPTION_KEY` não é usada. **Resolvido:** o entrypoint do SeaweedFS cria o bucket `resumes`, a identidade das apps só tem `Read`, `Write` e `List` nesse bucket, e o `queue` exige `REDIS_URL` em vez de cair na porta 6379.                                                                                                                                                                                                                                                 | [.env.example](../.env.example)                                                                                                                                            | Usar a `ENCRYPTION_KEY` na criptografia em repouso (§2.5)                                                        |
| 19  | P3     | **O `web` duplica tipos** que já existem nos contratos.                                                                                                                                                                                                                                                                                                                                                                                                                                           | [types.ts](../apps/web/src/lib/types.ts)                                                                                                                                   | Schemas de resposta em `contracts` + `z.infer`                                                                   |

---

## 2. Melhorias técnicas

### 2.1 Coleta: ingerir uma vez e comparar com todos os perfis

Hoje o scheduler cria um job `search` por **perfil × fonte**. Com 1.000 usuários e 2 perfis cada, os mesmos boards do Greenhouse e do Lever seriam baixados 2.000 vezes a cada janela. É desperdício e passa uma imagem ruim para os sites.

Proposta:

1. **Catálogo de empresas.** Nova tabela `CareerBoard (sourceId, token, empresa, ativo, lastFetchedAt, etag)` no lugar de `Source.config.boards`. Ela pode crescer com sugestões dos usuários (§3, item "Adicionar empresa").
2. **Fila `ingest`.** Um job por board, ou por consulta normalizada no caso de fontes de busca como a Gupy, com deduplicação global: se dez usuários buscam "react", a consulta é feita uma vez.
3. **Match pela vaga.** Cada vaga nova ou alterada dispara `match`, que pré-filtra no SQL os perfis candidatos (fonte, regras rígidas, FTS) e calcula a nota só para eles.
4. **Rate limit global** por host no Redis (item 6 da tabela) e respeito ao `robots.txt` (RNF-06).
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

- O PRD prevê Auth.js. O projeto Auth.js passou a ser mantido pela equipe do **Better Auth**, que recomenda o Better Auth para projetos novos. Vale reavaliar antes de implementar (confira o status atual).
- Como `web` e `api` ficam no mesmo domínio via Caddy (`/api`), uma **sessão em cookie** `httpOnly` validada pela API (sessões no Postgres) é mais simples e segura que repassar um JWT pelo browser.
- Registrar o `ConsentLog` no cadastro (versão dos termos + data) e já criar as rotas de exportar e excluir conta (RF-04).

### 2.5 Segurança e LGPD

- `@fastify/rate-limit` em toda a API, com limites mais baixos em login e upload.
- Upload: `@fastify/multipart` com limite de tamanho (ex.: 5 MB), validação pelo conteúdo (magic bytes) e não só pela extensão, e nome de arquivo gerado no servidor.
- Downloads de currículo só por **URL pré-assinada** de curta duração.
- Criptografia em repouso (RNF-05): SSE no bucket, ou AES-GCM na aplicação com `ENCRYPTION_KEY`, que também vale para os tokens OAuth.
- Um processor `cleanup` para a retenção configurável e a exclusão de conta (o arquivo some do S3, não só a linha do banco).
- O `redact` do pino deve cobrir campos do corpo (e-mail, telefone), além dos headers.
- **Storage:** o MinIO foi substituído pelo SeaweedFS (gateway S3). ~~Faltam healthcheck, criação do bucket e identidade com permissões mínimas~~ feito: o entrypoint cria o bucket, a identidade só lê, grava e lista `resumes`, e o healthcheck só fica verde com o gateway respondendo e o bucket criado. API e workers esperam o `s3` saudável no compose de produção.

### 2.6 Modelo de dados

- `ApplicationEvent` (tabela) no lugar de `Application.log` em JSON. Permite timeline, métricas (RF-63) e consultas por evento.
- Enums no Prisma (ou `CHECK`) para `status`, `mode`, `tone` e `kind`, alinhados aos enums dos contratos.
- `User.timezone` e preferências de notificação.
- `JobMatch.dismissedReason`: o feedback que alimenta os filtros (RF-42).
- `CareerBoard` (§2.1), `SourceRun` (histórico de execuções para o admin, RF-80) e `FormQuestion`/`SavedAnswer` (banco de respostas, §3).
- `Plan` e `UsageCounter`, para deixar a monetização preparada, como pede o PRD.
- Índices: ~~GIN em `tsvector(title, description)`, HNSW nos embeddings~~ feitos (item 13). Falta `Job(active, updatedAt)`.

### 2.7 Qualidade e DX

- ~~`git init` e o primeiro commit~~ feito.
- ~~ESLint + knip~~ feito: `pnpm lint` ([eslint.config.mjs](../eslint.config.mjs)), `pnpm knip` ([knip.json](../knip.json)) e `pnpm check`, que roda tudo.
- CI (GitHub Actions): ~~`pnpm install` com cache → `pnpm check`~~ feito em [ci.yml](../.github/workflows/ci.yml). Falta `pnpm build`.
- Testes:
  - API com `app.inject()` e Postgres real (Testcontainers ou um serviço na CI);
  - testes de contrato com fixtures para Greenhouse e Lever (hoje só a Gupy tem);
  - um teste de pipeline (search → match → application) com adapter falso;
  - e2e com Playwright nos fluxos críticos.
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

- [ ] Upload de CV → S3 → `ResumeVersion` → `resume-parse` (item 3)
- [ ] `AiProvider` real (extração estruturada)
- [ ] Corrigir dedupe, limite diário, scoring, 403/429 e rate limit global (itens 4–9)
- [ ] Testes de contrato do Greenhouse e do Lever + testes da API

### Etapa 2 — MVP para usuários reais (M/G)

- [ ] Login + consentimento + exportar e excluir conta; remover o bypass implícito (item 8)
- [ ] Ações na lista de vagas: detalhes, **candidatar**, **não tenho interesse**, pré-visualizar (RF-24, RF-42)
- [ ] Kanban completo com troca de status e notas (itens 10 e 11)
- [ ] Formulários completos: contrato, salário, blacklist, frequência, respostas padrão e modelos de carta
- [ ] Notificações por e-mail: resumo diário e "ação necessária"
- [ ] Onboarding a partir do CV

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
