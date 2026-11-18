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
- Hoje o bypass de dev é implícito (`NODE_ENV !== 'production'`). Troque por uma flag explícita `AUTH_DEV_BYPASS=true`, e o servidor recusa subir com ela em produção (item 8 de `docs/melhorias.md`).
- Rate limit (`@fastify/rate-limit`) mais baixo em login, cadastro e recuperação de senha.

### Upload e download de currículo

- `@fastify/multipart` com limite de tamanho (ex.: 5 MB) e um arquivo por requisição.
- Aceite só PDF e DOCX **pelo conteúdo** (magic bytes: PDF começa com `%PDF-`; DOCX é um zip `PK\x03\x04`), não pela extensão.
- A chave no S3 é gerada no servidor (ex.: `resumes/<userId>/<resumeId>/<versao>-<uuid>.pdf`). O nome original vira só metadado (`fileName`).
- Download **só** por URL pré-assinada de curta duração (≤ 5 min), emitida depois da checagem de dono.

### Criptografia (RNF-05)

- Arquivos: AES-256-GCM na aplicação com `ENCRYPTION_KEY` antes de gravar no S3. Isso funciona em qualquer storage (SeaweedFS hoje, R2/S3 depois). A criptografia do próprio storage é um complemento, não um substituto.
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
- Cada serviço tem a própria credencial no storage S3, com acesso só ao bucket e às ações necessárias. Hoje a identidade `cvpilot` do SeaweedFS ([s3-entrypoint.sh](../../../infra/docker/seaweedfs/s3-entrypoint.sh)) tem ação `Admin`; restrinja ao implementar o upload.
- O `helmet` e o CORS restrito a `API_CORS_ORIGIN` já estão ligados; não afrouxe.

## Checklist de revisão (para toda mudança que toca dados pessoais)

- [ ] Nenhuma consulta sem `userId`; nenhum id do cliente aceito sem checar o dono
- [ ] Resposta sem campos sensíveis (`passwordHash`, `encryptedTokens`, dados de outro usuário)
- [ ] Upload validado pelo conteúdo; download só por URL pré-assinada
- [ ] Nada pessoal em log, payload de fila ou mensagem de erro
- [ ] Tokens e arquivos criptografados; segredos fora do código
- [ ] Exclusão de conta cobre os dados novos (banco **e** arquivos)
