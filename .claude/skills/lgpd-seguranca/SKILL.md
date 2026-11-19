---
name: lgpd-seguranca
description: Aplica as regras de segurança e LGPD do CV Pilot ao lidar com dados pessoais. Cobre autenticação e sessão, isolamento por userId, upload e download de currículos, criptografia de arquivos e tokens OAuth, consentimento, exportação e exclusão de conta, retenção, segredos e logs sem dados pessoais. Use ao implementar login, upload, OAuth (Gmail/Outlook) ou endpoints que retornam dados do usuário, ao excluir conta, ou ao revisar uma mudança em busca de vazamento de dados.
---

# Segurança e LGPD

## Dados pessoais neste projeto

`User` (nome, e-mail, telefone, cidade, links) · arquivos de currículo e `ResumeVersion.parsed` · cartas, respostas e `notes` de `Application` · `OAuthConnection.encryptedTokens` · `ConsentLog.ip`.

Vagas (`Job`) e fontes (`Source`) **não** são dados pessoais.

## Regras

### Isolamento

- Toda consulta é filtrada por `userId`. Recurso de outro usuário responde 404. Ids recebidos no body têm o dono validado (skill `modulo-api`).
- Rotas de admin exigem `role === 'ADMIN'`.

### Autenticação (RF-01)

- Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`. Web e API ficam no mesmo domínio via Caddy (`/api`).
- Senha com hash forte (argon2id ou bcrypt), nunca reversível. A escolha da biblioteca vira ADR em `docs/adr/`.
- Até existir login, o bypass de dev só liga com `AUTH_DEV_BYPASS=true` ([auth.ts](../../../apps/api/src/plugins/auth.ts)), e a API se recusa a subir com essa flag em `NODE_ENV=production`. Ao implementar o login, apague o bypass junto.
- Rate limit (`@fastify/rate-limit`) mais baixo em login, cadastro e recuperação de senha.

### Upload e download de currículo

O upload já existe ([resumes/service.ts](../../../apps/api/src/modules/resumes/service.ts)); siga o mesmo caminho para qualquer arquivo pessoal novo:

- `@fastify/multipart` com limite de tamanho (5 MB) e um arquivo por requisição, registrado só no plugin das rotas que recebem arquivo.
- Aceite só PDF e DOCX **pelo conteúdo** (`detectResumeFileType` no `core`: PDF começa com `%PDF-`; DOCX é um zip com `word/document.xml`), não pela extensão.
- A chave no S3 é gerada no servidor (`resumeStorageKey`: `<userId>/<resumeId>/<versão>-<uuid>.<ext>`). O nome original vira só metadado (`fileName`, mascarado nos logs), e a resposta da API nunca leva o `storageKey`.
- **Download:** o arquivo no S3 é cifrado, então uma URL pré-assinada entregaria só a cifra. A API confere o dono e serve o arquivo decifrado ([ADR 0002](../../../docs/adr/0002-criptografia-de-curriculos.md)).

### Criptografia (RNF-05)

- Arquivos: AES-256-GCM na aplicação com `ENCRYPTION_KEY` antes de gravar no S3, pelo [`@cv-pilot/storage`](../../../packages/storage/src). Isso funciona em qualquer storage (SeaweedFS hoje, R2/S3 depois). A criptografia do próprio storage é um complemento, não um substituto.
- Tokens OAuth: **sempre** AES-256-GCM com IV aleatório por registro, guardando IV + tag + texto cifrado. Prefixe com um id da chave, para permitir rotação.
- Tokens e chaves nunca são retornados pela API nem logados.

### Consentimento (RF-03)

- Grave `ConsentLog` (versão dos termos, data, IP) no cadastro e a cada nova versão dos termos. Sem aceite, a conta não usa o sistema.
- A política lista os operadores (provedor de IA, e-mail, hospedagem).

### Direitos do titular (RF-04)

- **Exportar:** JSON com todos os dados do usuário + links pré-assinados dos arquivos.
- **Excluir:** apagar os arquivos no S3, revogar os tokens OAuth e apagar as linhas (a cascata a partir de `User` já cobre o banco). Se houver período de carência, use `deletedAt` e um processor `cleanup` que conclui depois.
- A retenção é configurável. O `cleanup` remove o que passou do prazo.

### Logs e erros

- Logue ids, nunca conteúdo pessoal. O [`@cv-pilot/logger`](../../../packages/logger/src/index.ts) mascara `authorization`, `cookie` e os campos de `SENSITIVE_FIELDS` (e-mail, telefone, senha, tokens, carta, respostas) no primeiro e no segundo nível do objeto logado. Campo pessoal novo = entrada nova nessa lista, com teste.
- Erros 5xx não expõem detalhes ao cliente (o `errorHandler` já responde `internal_error`).

### Segredos e configuração

- `.env` nunca vai para o Git. Segredo novo = entrada com valor de exemplo no `.env.example`.
- Cada serviço tem a própria credencial no storage S3, com acesso só ao bucket e às ações necessárias. A identidade `cvpilot` do SeaweedFS ([s3-entrypoint.sh](../../../infra/docker/seaweedfs/s3-entrypoint.sh)) só tem `Read`, `Write` e `List` no bucket `resumes`.
- O `helmet` e o CORS restrito a `API_CORS_ORIGIN` já estão ligados; não afrouxe.

## Checklist de revisão (para toda mudança que toca dados pessoais)

- [ ] Nenhuma consulta sem `userId`; nenhum id do cliente aceito sem checar o dono
- [ ] Resposta sem campos sensíveis (`passwordHash`, `encryptedTokens`, dados de outro usuário)
- [ ] Upload validado pelo conteúdo; download só pela API, depois da checagem de dono
- [ ] Nada pessoal em log, payload de fila ou mensagem de erro
- [ ] Tokens e arquivos criptografados; segredos fora do código
- [ ] Exclusão de conta cobre os dados novos (banco **e** arquivos)
