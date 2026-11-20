---
name: lgpd-seguranca
description: Aplica as regras de segurança e LGPD do CV Pilot ao lidar com dados pessoais. Cobre autenticação e sessão, isolamento por userId, upload e download de currículos, criptografia de arquivos e tokens OAuth, consentimento, exportação e exclusão de conta, retenção, segredos e logs sem dados pessoais. Use ao implementar login, upload, OAuth (Gmail/Outlook) ou endpoints que retornam dados do usuário, ao excluir conta, ou ao revisar uma mudança em busca de vazamento de dados.
---

# Segurança e LGPD

## Dados pessoais neste projeto

`User` (nome, e-mail, telefone, cidade, links, pretensão salarial, disponibilidade) · `Session` (IP, user agent, token) e `Account` (hash da senha) · arquivos de currículo e `ResumeVersion.parsed` · `CoverLetterTemplate.body` · cartas, respostas e `notes` de `Application` · `OAuthConnection.encryptedTokens` · `ConsentLog.ip`.

`Notification.data` guarda só ids e contagens, de propósito: o texto que identifica a vaga ou o currículo é buscado na hora de mostrar, filtrando pelo dono.

Vagas (`Job`) e fontes (`Source`) **não** são dados pessoais.

## Regras

### Isolamento

- Toda consulta é filtrada por `userId`. Recurso de outro usuário responde 404. Ids recebidos no body têm o dono validado (skill `modulo-api`).
- Rotas de admin exigem `role === 'ADMIN'`.

### Autenticação (RF-01)

- Login por e-mail e senha com **Better Auth**, montado na API em `/auth` ([auth.ts](../../../apps/api/src/auth.ts), [ADR 0003](../../../docs/adr/0003-login-com-better-auth.md)). Sessões no Postgres, cookie `httpOnly` (`cvpilot.session_token`, `Secure` em produção), senha com scrypt e mínimo de 8 caracteres. Não há bypass: em dev, entre com `dev@cvpilot.local` (senha em `DEV_USER_PASSWORD`, criada pelo `pnpm db:seed`).
- O [authPlugin](../../../apps/api/src/plugins/auth.ts) lê a sessão e preenche `req.userId`; sem sessão, 401. Só `/health` e `/auth/*` são públicas.
- `BETTER_AUTH_URL` inclui o caminho (`http://localhost:4000/auth` em dev, `https://<domínio>/api/auth` em produção) e `BETTER_AUTH_SECRET` é obrigatório. As origens do web vêm de `API_CORS_ORIGIN` (CORS e `trustedOrigins`).
- Sem envio de e-mail ainda: não há verificação de e-mail nem "esqueci a senha". A senha muda na página da conta (revoga as outras sessões).
- Rate limit: o do Better Auth vale em login e cadastro. Falta o `@fastify/rate-limit` no resto da API.

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
- Chaves da extensão do navegador ([ADR 0010](../../../docs/adr/0010-extensao-com-token-proprio.md)): só o SHA-256 fica no banco, o token aparece uma vez (na criação) e abre **só** as rotas `/extension`, que por sua vez não aceitam o cookie do login. Rota nova para a extensão entra nesse prefixo e expõe o mínimo.

### Consentimento (RF-03)

- A versão vigente é `TERMS_VERSION` em [consent.ts](../../../packages/contracts/src/consent.ts). O cadastro exige o aceite, e `POST /me/consents` grava o `ConsentLog` (versão, data e IP; a API confia no proxy, `trustProxy`).
- O [consentPlugin](../../../apps/api/src/plugins/consent.ts) responde 403 `consent_required` em tudo, menos `/me`, até o usuário aceitar a versão atual. O web manda para `/aceite`.
- Mudou o texto dos termos ou da política ([/termos](../../../apps/web/src/app/termos/page.tsx))? Suba o `TERMS_VERSION`: todo mundo aceita de novo.
- A política lista os operadores (provedor de IA, hospedagem e, quando houver, e-mail). O texto v1 é rascunho e precisa de revisão jurídica antes de usuários reais.

### Direitos do titular (RF-04)

- **Exportar:** `GET /me/export` ([account/service.ts](../../../apps/api/src/modules/account/service.ts)) devolve um JSON com todos os dados do usuário, sem hash de senha nem tokens de sessão. Os arquivos entram como links para `GET /resumes/:id/versions/:versionId/file`, que confere o dono. Tabela nova com dado do usuário = entra no `exportUserData`.
- **Excluir:** `POST /auth/delete-user` com a senha (o hook do Better Auth recusa sem ela). O `beforeDelete` apaga os arquivos no S3; se um falhar, a conta fica como estava. Depois a cascata a partir de `User` apaga as linhas. Falta revogar os tokens OAuth quando eles existirem. A exclusão é imediata; um período de carência pediria `deletedAt` e um processor `cleanup`.
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
- [ ] Exclusão de conta cobre os dados novos (banco **e** arquivos) e a exportação também os inclui
