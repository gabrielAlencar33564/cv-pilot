# PRD — CV Pilot

> Plataforma de busca de vagas e envio otimizado de currículos, com bots por site de vagas e currículos personalizados por site.

| Campo | Valor |
|---|---|
| Status | Rascunho v0.1 |
| Data | 2026-11-18 |
| Responsável | Gabriel |
| Nome provisório | CV Pilot (pode ser trocado) |

---

## 1. Visão geral

### 1.1 Problema
Quem procura emprego perde horas com a mesma rotina: entrar em vários sites, filtrar vagas, adaptar o currículo e preencher formulários repetidos. O resultado são poucas candidaturas, ou muitas candidaturas genéricas que não chamam a atenção do recrutador nem passam nos filtros dos ATS.

### 1.2 Solução
Um site onde o candidato:
1. cadastra **o que está buscando** (perfis de busca: cargo, senioridade, local, modelo de trabalho, salário etc.);
2. sobe **vários currículos** e define **qual currículo usar em cada site** (ex.: um técnico para a Gupy, outro mais humano para o LinkedIn);
3. recebe as vagas encontradas pelos **bots (workers)**, ordenadas por compatibilidade;
4. envia candidaturas **automáticas ou assistidas**, conforme o que cada site permite;
5. acompanha tudo num painel de candidaturas.

### 1.3 Objetivos
- Diminuir o tempo por candidatura em mais de 80% comparado ao processo manual.
- Aumentar a qualidade das candidaturas: o currículo certo e a carta certa para cada site e cada vaga.
- Arquitetura de **plugins**: adicionar um site novo exige só um adapter novo, sem mexer no núcleo.

### 1.4 Fora do escopo (v1)
- Lado do recrutador (ATS próprio, triagem de candidatos).
- Burlar CAPTCHA, anti-bot ou 2FA de qualquer site.
- App mobile nativo.
- Pagamentos e planos (deixar o modelo de dados preparado, sem implementar).

---

## 2. Personas

| Persona | Descrição | Necessidade principal |
|---|---|---|
| **Candidato ativo** | Desempregado ou em transição, aplica para muitas vagas por semana | Volume com qualidade, sem retrabalho |
| **Candidato passivo** | Empregado, aberto a propostas boas | Alertas filtrados, poucas candidaturas, muito bem direcionadas |
| **Admin da plataforma** | Mantém os bots e os sites cadastrados | Ver a saúde dos adapters, ligar e desligar fontes, ver erros |

---

## 3. Requisitos funcionais

### 3.1 Conta e perfil
- **RF-01** Cadastro e login por e-mail + senha e OAuth (Google; LinkedIn opcional).
- **RF-02** Perfil base do candidato: nome, contato, cidade, links (LinkedIn, GitHub, portfólio), pretensão salarial e disponibilidade.
- **RF-03** Aceite explícito de termos e de tratamento de dados (LGPD), com registro de data e versão.
- **RF-04** Exportar e excluir todos os dados da conta (direitos do titular, LGPD).

### 3.2 Perfis de busca ("o que estou buscando")
- **RF-10** O usuário cria **um ou mais perfis de busca**. Exemplos: "Dev Front-end Pleno Remoto" e "Tech Lead Híbrido SP".
- **RF-11** Campos de cada perfil:
  - cargos / palavras-chave (inclusão e exclusão)
  - senioridade
  - localização + raio, ou remoto / híbrido / presencial
  - faixa salarial (opcional)
  - tipo de contrato (CLT, PJ, estágio, temporário)
  - empresas a evitar (blacklist)
  - **sites onde buscar** (seleção entre as fontes ativas)
  - frequência de busca (ex.: a cada 6h) e limite diário de candidaturas
  - nota mínima de compatibilidade para envio automático
- **RF-12** Pausar, retomar, duplicar e excluir perfis de busca.

### 3.3 Currículos e personalização por site (diferencial do produto)
- **RF-20** Upload de **vários currículos** (PDF/DOCX), cada um com nome, descrição e tags (ex.: "Técnico", "Humanizado", "Inglês").
- **RF-21** Extração automática dos dados do currículo (habilidades, experiências, formação, idiomas) por IA, para o matching e o preenchimento de formulários. O usuário pode revisar e corrigir o resultado.
- **RF-22** **Regras de envio por site**: para cada fonte, o usuário escolhe:
  - qual currículo enviar
  - qual modelo de carta de apresentação usar (ou nenhum)
  - o tom da carta gerada por IA (técnico, humanizado, formal, direto)
  - respostas padrão para perguntas frequentes do formulário (pretensão, disponibilidade, "por que quer trabalhar aqui")
  - o modo de envio preferido (automático ou assistido, dentro do que a fonte suporta)
- **RF-23** As regras também podem ser definidas **por perfil de busca + site**. Ordem de precedência, da mais específica para a mais geral:
  1. Perfil de busca + site
  2. Site
  3. Perfil de busca
  4. Padrão da conta
- **RF-24** Pré-visualizar, antes de enviar, exatamente o que vai para cada vaga: currículo, carta e respostas.
- **RF-25** Versionamento dos currículos. Cada candidatura guarda a versão exata que foi enviada.

**Exemplo de configuração:**

| Site | Currículo | Carta | Tom | Modo |
|---|---|---|---|---|
| Gupy | "CV Técnico v3" | Modelo "Objetiva" | Técnico | Automático |
| LinkedIn | "CV Humanizado v2" | Gerada por IA | Humanizado | Assistido |
| Greenhouse | "CV Inglês v1" | Modelo "Cover EN" | Formal | Automático |
| Padrão | "CV Técnico v3" | Nenhuma | — | Assistido |

### 3.4 Busca de vagas (bots / workers)
- **RF-30** Cada site é implementado como um **adapter** independente (ver seção 6.3).
- **RF-31** Um scheduler dispara buscas por perfil de busca × fonte, respeitando a frequência configurada.
- **RF-32** As vagas coletadas são normalizadas num formato único (título, empresa, local, modelo, salário, descrição, requisitos, URL, fonte, data).
- **RF-33** Deduplicação entre fontes (hash de empresa + título normalizado + local), mantendo os links de todas as fontes.
- **RF-34** Vagas encerradas ou expiradas são marcadas como inativas.
- **RF-35** Admin pode ligar e desligar fontes e ajustar o limite de requisições de cada uma.

### 3.5 Matching
- **RF-40** Nota de compatibilidade (0–100) entre vaga e perfil de busca + currículo, combinando:
  - similaridade semântica (embeddings) entre a vaga e o currículo
  - regras rígidas (local, modelo de trabalho, salário, blacklist, palavras de exclusão)
- **RF-41** Mostrar por que a vaga foi recomendada (habilidades em comum e o que falta).
- **RF-42** O usuário pode marcar uma vaga como "não tenho interesse", e isso alimenta os filtros.

### 3.6 Envio de candidaturas
- **RF-50** Três modos de envio, definidos pelo adapter da fonte:
  | Modo | Como funciona | Quando usar |
  |---|---|---|
  | **API** | Envio direto pela API pública do ATS | Fontes que aceitam candidatura via API |
  | **E-mail** | Envio pelo e-mail do próprio candidato (OAuth Gmail/Outlook) com currículo + carta | Vagas que pedem "envie para rh@..." |
  | **Assistido** | Extensão de navegador preenche o formulário; o candidato revisa e clica em enviar | Portais que proíbem automação (ex.: LinkedIn) ou que têm CAPTCHA/login |
- **RF-51** Fila de envio com limite diário por usuário e por fonte e intervalo aleatório entre envios.
- **RF-52** Envio automático só para vagas acima da nota mínima do perfil. As demais ficam como "sugeridas" para aprovação manual.
- **RF-53** Se um bloqueio aparecer (CAPTCHA, login, pergunta desconhecida), o bot **para** e a candidatura vai para "Ação necessária". O bot nunca tenta burlar o bloqueio.
- **RF-54** Carta de apresentação gerada por IA a partir da vaga + currículo + tom da regra do site, com edição antes do envio (opcional, por regra).

### 3.7 Painel de candidaturas
- **RF-60** Kanban: Sugerida → Na fila → Enviada → Em processo → Entrevista → Oferta / Recusada / Sem resposta.
- **RF-61** Cada candidatura guarda vaga, fonte, data, versão do currículo, carta, respostas e log do envio.
- **RF-62** O usuário atualiza o status manualmente e pode anotar observações.
- **RF-63** Métricas: candidaturas por fonte, taxa de resposta por currículo e por site. Isso permite comparar qual currículo funciona melhor em qual site.

### 3.8 Notificações
- **RF-70** Resumo diário ou semanal por e-mail com novas vagas compatíveis.
- **RF-71** Alerta de "Ação necessária" (candidaturas assistidas pendentes ou falhas).

### 3.9 Administração
- **RF-80** Painel admin: status de cada adapter (última execução, taxa de erro, vagas coletadas) e filas (pendentes, falhas, retentativas).
- **RF-81** Reexecutar jobs com falha e desativar um adapter quebrado sem novo deploy.

---

## 4. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | **TypeScript** em todo o código (front, API, workers, pacotes compartilhados), em modo `strict`. |
| RNF-02 | **pnpm workspaces** como gerenciador de pacotes e monorepo (+ Turborepo para orquestrar build/lint/test). |
| RNF-03 | Tudo roda em **Docker** (Docker Compose) numa máquina virtual única na v1, preparado para escalar os workers horizontalmente. |
| RNF-04 | **Escalabilidade**: API, front e workers são serviços separados, com deploy e escala independentes. Os workers escalam por réplica e por fila. |
| RNF-05 | **LGPD**: currículos criptografados em repouso, tokens OAuth criptografados, logs sem dados pessoais, retenção configurável. |
| RNF-06 | **Conformidade com os sites**: respeitar termos de uso e `robots.txt`, limitar requisições por domínio, identificar o bot e nunca burlar CAPTCHA ou anti-bot. |
| RNF-07 | **Resiliência**: retentativa com intervalo crescente, fila de mensagens mortas (DLQ), jobs idempotentes. |
| RNF-08 | **Observabilidade**: logs estruturados (pino), health checks em todos os serviços, métricas básicas por adapter. |
| RNF-09 | **Desempenho**: páginas principais em menos de 2 s; busca de vagas paginada no servidor. |
| RNF-10 | **Testes**: unitários no core, testes de contrato por adapter (fixtures de HTML/JSON salvos), e2e dos fluxos críticos. |

---

## 5. Stack técnica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | **Next.js** (App Router) + TypeScript | Definido no projeto |
| UI | **Mantine** (components, form, dates, notifications, dropzone) | Biblioteca pronta e completa: formulários, tabelas, datas, upload e modais sem precisar construir UI |
| Data fetching | TanStack Query | Cache e estados de carregamento |
| API | **Fastify** + TypeScript + Zod | Rápido, tipado, validação com schemas compartilhados |
| Auth | Auth.js (NextAuth) no front + JWT validado na API | OAuth Google e e-mail/senha |
| Banco | **PostgreSQL 16** + **pgvector** | Dados relacionais + embeddings para o matching |
| ORM | Prisma | Migrations e tipos gerados |
| Filas | **BullMQ** + **Redis** | Scheduler, filas por fonte, retentativas, limite de requisições |
| Coleta | `undici`/`fetch` + Cheerio; **Playwright** só nos adapters `browser` | Do mais leve ao mais pesado |
| Arquivos | S3 compatível (**SeaweedFS** na VM; R2/S3 depois) | Currículos e anexos |
| IA | LLM para extrair dados do currículo, gerar cartas e embeddings | Matching e personalização |
| E-mail | Gmail/Outlook via OAuth (envio pelo candidato) + SMTP transacional (notificações) | |
| Extensão | Extensão Chrome (Manifest V3, TypeScript) | Modo assistido |
| Monorepo | pnpm workspaces + Turborepo | Builds com cache e tarefas por pacote |
| Infra | Docker + Docker Compose + Caddy (proxy reverso + HTTPS) | Rodar na VM |

> Alternativa de UI: **shadcn/ui** (Radix + Tailwind), caso se queira mais controle visual no futuro. Para "não se preocupar com UI", o Mantine é a opção mais completa.

---

## 6. Arquitetura

### 6.1 Visão de serviços

```
                    ┌────────────────────────┐
   Usuário ───────▶ │  Caddy (HTTPS/proxy)   │
                    └─────┬────────────┬─────┘
                          │            │
                ┌─────────▼───┐   ┌────▼────────┐
                │  web        │──▶│  api        │
                │  Next.js    │   │  Fastify    │
                └─────────────┘   └──┬──────┬───┘
                                     │      │ enfileira jobs
                       ┌─────────────▼┐   ┌─▼──────────┐
                       │ PostgreSQL   │   │  Redis     │
                       │ + pgvector   │   │  (BullMQ)  │
                       └──────▲───────┘   └─▲────┬─────┘
                              │             │    │ consome
                       ┌──────┴─────────────┴────▼──────┐
                       │ workers (N réplicas)           │
                       │  • scheduler                   │
                       │  • search  (adapters)          │
                       │  • match   (IA/embeddings)     │
                       │  • apply   (API / e-mail)      │
                       │  • notify                      │
                       └──────────────┬─────────────────┘
                                      │
                               ┌──────▼──────┐
                               │ Seaweed(S3) │ currículos
                               └─────────────┘

  Extensão Chrome (modo assistido) ──▶ api
```

### 6.2 Estrutura de pastas

```
cv-pilot/
├── apps/
│   ├── web/                    # Next.js (frontend)
│   │   ├── src/app/            # rotas (App Router)
│   │   │   ├── (auth)/         # login, cadastro
│   │   │   ├── (dashboard)/    # vagas, candidaturas, currículos, perfis, regras
│   │   │   └── admin/          # painel admin
│   │   ├── src/features/       # módulos por domínio (ui + hooks + chamadas)
│   │   │   ├── jobs/
│   │   │   ├── resumes/
│   │   │   ├── search-profiles/
│   │   │   ├── send-rules/
│   │   │   └── applications/
│   │   ├── src/lib/            # client da API, auth, providers
│   │   └── Dockerfile
│   │
│   ├── api/                    # Fastify (backend)
│   │   ├── src/modules/        # um módulo por domínio
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── search-profiles/
│   │   │   ├── resumes/
│   │   │   ├── send-rules/
│   │   │   ├── jobs/
│   │   │   ├── applications/
│   │   │   └── admin/
│   │   │       └── (cada módulo: routes.ts, service.ts, repository.ts, schemas.ts)
│   │   ├── src/plugins/        # db, redis, auth, storage, queues
│   │   ├── src/server.ts
│   │   └── Dockerfile
│   │
│   ├── workers/                # bots e processamento assíncrono
│   │   ├── src/processors/     # search, match, apply, notify, cleanup
│   │   ├── src/scheduler/      # agendamento por perfil × fonte
│   │   ├── src/main.ts         # sobe processors por variável de ambiente (WORKER_QUEUES)
│   │   └── Dockerfile          # imagem leve; variante com Playwright em target separado
│   │
│   └── extension/              # extensão Chrome (modo assistido)
│
├── packages/
│   ├── core/                   # tipos de domínio, regras (precedência de regras, dedupe, scoring)
│   ├── adapters/               # um adapter por site de vagas
│   │   ├── src/registry.ts     # registro dos adapters ativos
│   │   ├── src/types.ts        # interface JobSourceAdapter
│   │   ├── src/gupy/
│   │   ├── src/greenhouse/
│   │   ├── src/lever/
│   │   ├── src/linkedin/       # somente busca permitida + modo assistido
│   │   └── src/<novo-site>/    # adicionar fonte = adicionar pasta
│   ├── db/                     # schema Prisma, migrations, client
│   ├── queue/                  # nomes de filas, tipos de payload, helpers BullMQ
│   ├── ai/                     # extração de CV, carta, embeddings
│   ├── contracts/              # schemas Zod compartilhados (API ↔ web ↔ extensão)
│   └── config/                 # tsconfig, eslint, prettier compartilhados
│
├── infra/
│   ├── docker/
│   │   ├── compose.yaml        # produção na VM
│   │   ├── compose.dev.yaml    # override de dev (bind mount + watch)
│   │   └── caddy/Caddyfile
│   └── scripts/                # backup do Postgres, deploy, seed
│
├── .dockerignore
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── docs/                       # PRD, visão geral e análise de melhorias
```

**Princípios da estrutura:**
- `apps/*` são serviços implantáveis. `packages/*` são bibliotecas internas e nunca rodam sozinhas.
- As regras de negócio ficam em `packages/core`, sem dependência de framework, para serem usadas pela API e pelos workers.
- Os contratos (`packages/contracts`) são a fonte única dos tipos trafegados entre front, API e extensão.
- Os workers são **um app com vários processors**. Cada réplica escolhe quais filas consome por variável de ambiente, o que permite escalar só o `search` ou só o `apply`.

### 6.3 Contrato do adapter

```ts
export interface JobSourceAdapter {
  id: string;                         // "gupy", "greenhouse", "linkedin"...
  displayName: string;
  kind: "api" | "html" | "browser";   // estratégia de coleta
  rateLimit: { requests: number; perMs: number };

  search(query: SearchQuery, ctx: AdapterContext): AsyncIterable<RawJob>;
  normalize(raw: RawJob): NormalizedJob;
  isStillOpen?(job: NormalizedJob, ctx: AdapterContext): Promise<boolean>;

  apply?: {
    modes: Array<"api" | "email" | "assisted">;
    submit(input: ApplyInput, ctx: AdapterContext): Promise<ApplyResult>;
    // ApplyResult: "sent" | "needs_action" (com motivo) | "failed"
  };

  // Para o modo assistido: mapeamento de campos do formulário para a extensão
  formMap?: FormFieldMap;
}
```

Checklist para adicionar um site novo:
1. Criar `packages/adapters/src/<site>/` implementando a interface.
2. Adicionar fixtures e testes de contrato.
3. Registrar em `registry.ts`.
4. Cadastrar a fonte no admin (ativa/inativa e limite de requisições). Não é preciso alterar API, front ou workers.

### 6.4 Filas

| Fila | Produz | Consome | Observação |
|---|---|---|---|
| `search:{source}` | scheduler | processor search | Limite de requisições por fonte |
| `match` | search | processor match | Calcula nota por perfil |
| `apply:{source}` | match / ação do usuário | processor apply | Limite diário por usuário |
| `notify` | match / apply | processor notify | E-mails e alertas |
| `resume-parse` | api (upload) | processor ai | Extração de dados do CV |

### 6.5 Resolução de regra de envio (pseudo-código)

```ts
function resolveSendRule(userId, searchProfileId, sourceId): SendRule {
  return (
    findRule({ userId, searchProfileId, sourceId }) ??
    findRule({ userId, sourceId, searchProfileId: null }) ??
    findRule({ userId, searchProfileId, sourceId: null }) ??
    findDefaultRule(userId)
  );
}
```

---

## 7. Modelo de dados (resumo)

```
User ─┬─< SearchProfile >─┬─ SearchProfileSource >── Source
      │                   │
      ├─< Resume ─< ResumeVersion (arquivo, dados extraídos, embedding)
      │
      ├─< CoverLetterTemplate
      │
      ├─< SendRule (userId, searchProfileId?, sourceId?, resumeId,
      │             coverLetterTemplateId?, tone, mode, defaultAnswers JSON)
      │
      ├─< Application (jobId, sourceId, resumeVersionId, coverLetter,
      │                answers, status, score, log[])
      │
      └─< OAuthConnection (gmail/outlook, tokens criptografados)

Source (id, nome, kind, ativo, rateLimit, modos de envio)
Job (fonte(s), dados normalizados, hash de dedupe, embedding, ativa)
JobMatch (jobId, searchProfileId, score, motivos)
ConsentLog (userId, versão dos termos, data)
```

Índices importantes: `Job.dedupeHash` (único), `JobMatch(searchProfileId, score)`, `SendRule(userId, searchProfileId, sourceId)` (único), índice vetorial em `Job.embedding`.

---

## 8. Docker e implantação na VM

### 8.1 Serviços do Compose

| Serviço | Imagem | Réplicas | Volume |
|---|---|---|---|
| `caddy` | caddy:2 | 1 | certificados |
| `web` | build `apps/web` | 1+ | — |
| `api` | build `apps/api` | 1+ | — |
| `workers` | build `apps/workers` (leve) | N | — |
| `workers-browser` | build `apps/workers` (target Playwright) | 0–N | — |
| `postgres` | pgvector/pgvector:pg16 | 1 | `pgdata` |
| `redis` | redis:7 | 1 | `redisdata` |
| `s3` | chrislusf/seaweedfs | 1 | `s3data` |

### 8.2 Regras obrigatórias para os Dockerfiles
Para evitar estourar o build cache do Docker:
1. Começar com `# syntax=docker/dockerfile:1`.
2. **Multi-stage**: `deps` → `build` → `runtime` enxuto (sem store do pnpm, sem devDependencies, sem código-fonte desnecessário).
3. Copiar **apenas** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` e `.npmrc` antes do install. O `COPY . .` vem só depois. Usar `pnpm fetch` + `pnpm install --offline --frozen-lockfile` ou `turbo prune --docker` para copiar só o necessário de cada app.
4. Cache mount para o store do pnpm:
   `RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile`
5. `pnpm deploy --prod` (ou equivalente) para gerar o bundle final de cada app.
6. `.dockerignore` na raiz com no mínimo: `node_modules`, `.git`, `dist`, `build`, `.next`, `.turbo`, `coverage`, `.env*`, `*.log`, `playwright-report`, `test-results`, screenshots.
7. Next.js com `output: "standalone"`.
8. Imagens rodando com usuário não root e com `HEALTHCHECK`.
9. **Desenvolvimento**: bind mount + dev server (`compose.dev.yaml` / `docker compose watch`), e não `up --build` repetido.
10. Rodar `docker system df` periodicamente. Se o build cache passar de ~20 GB, avaliar `docker builder prune`.

### 8.3 VM
- v1: uma VM (sugestão: 4 vCPU / 8 GB RAM / 80 GB SSD) com Docker + Compose.
- Backup diário do Postgres e do storage S3 (SeaweedFS) para um storage externo.
- Segredos em `.env` fora do repositório (`.env.example` versionado).
- Evolução: separar Postgres/Redis em serviços gerenciados e workers em outra VM, sem mudar o código.

---

## 9. Conformidade e riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Termos de uso de portais (LinkedIn, Indeed, Catho) proíbem automação | Banimento de contas, risco jurídico | Priorizar fontes com dados públicos/ATS; nesses portais, só o modo **assistido** |
| CAPTCHA, anti-bot, mudanças de layout | Adapter quebra | Nunca burlar; status "Ação necessária"; testes de contrato e alertas no admin |
| Dados pessoais (LGPD) | Multas e perda de confiança | Consentimento, criptografia, exportação e exclusão, logs sem dados pessoais |
| Envio em massa vira spam | Reputação do candidato | Nota mínima, limite diário, intervalo entre envios, revisão opcional |
| E-mail do candidato marcado como spam | Entregabilidade | Envio pela conta do candidato via OAuth, volume baixo, conteúdo personalizado |
| Custo de IA | Custo variável | Cache de embeddings, extração do CV só uma vez por versão, modelos menores para tarefas simples |

---

## 10. Roadmap

### Fase 0 — Fundação
- Monorepo pnpm + Turborepo, pacotes `config`, `contracts`, `db`, `core`
- Docker Compose (dev e prod), Caddy, Postgres + pgvector, Redis, SeaweedFS (S3)
- CI: lint, typecheck e testes

### Fase 1 — MVP
- Auth, perfil e consentimento LGPD
- Perfis de busca (CRUD)
- Upload de currículos + extração por IA + versionamento
- **Regras de envio por site** com precedência
- Adapters de busca: Gupy, Greenhouse e Lever
- Matching com nota e motivos
- Lista de vagas + painel de candidaturas
- Envio por e-mail (OAuth Gmail)

### Fase 2 — Automação
- Envio via API nos ATS que suportam
- Extensão Chrome (modo assistido) + adapter LinkedIn (assistido)
- Cartas geradas por IA com tom por site
- Resumos por e-mail e alertas

### Fase 3 — Escala e inteligência
- Mais adapters (Workable, SmartRecruiters, Solides, InfoJobs...)
- Métricas por currículo × site (qual currículo converte melhor em cada site)
- Painel admin completo e escala horizontal dos workers

---

## 11. Métricas de sucesso

| Métrica | Meta inicial |
|---|---|
| Tempo médio por candidatura | < 1 min (assistido) / 0 (automático) |
| Candidaturas enviadas sem erro | > 95% |
| Taxa de resposta das empresas | acompanhar por site e currículo; meta de +20% contra a linha de base do usuário |
| Adapters saudáveis (sem erro nas últimas 24 h) | > 90% |
| Usuários com ≥ 2 currículos e regras por site configuradas | > 40% |

---

## 12. Questões em aberto
1. O nome definitivo do produto.
2. Qual provedor de LLM usar (custo vs. qualidade em português).
3. Modelo de monetização (freemium por limite de candidaturas?).
4. Quais fontes priorizar além de Gupy, Greenhouse e Lever.
5. Fazer só a busca no LinkedIn, ou só o modo assistido a partir da página que o usuário abriu.
6. Domínio e provedor da VM.
