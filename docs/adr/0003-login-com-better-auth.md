# ADR 0003: Login por e-mail e senha com Better Auth

- **Status:** aceita
- **Data:** 2026-11-19

## Contexto

O RF-01 pede cadastro e login. Até a Etapa 1, a API aceitava qualquer usuário pelo cabeçalho `x-dev-user-id` (só com `AUTH_DEV_BYPASS=true`). O PRD previa o Auth.js; o projeto Auth.js passou a ser mantido pela equipe do Better Auth, que o recomenda para projetos novos. O envio de e-mail ficou para depois, por decisão do responsável pelo produto.

## Decisão

- **Better Auth 1.7**, montado na API Fastify em `/auth/*`, com o adapter do Prisma (o pacote declara suporte ao Prisma 5, 6 e 7; o projeto usa o 6.19).
- **Só e-mail e senha:**
  - senha mínima de 8 caracteres;
  - hash com scrypt, guardado em `Account.password`;
  - sem verificação de e-mail e sem "esqueci a senha", que dependem do envio de e-mail; o usuário logado troca a senha na conta.
- **Sessão:**
  - fica no Postgres (`Session`);
  - vai num cookie `httpOnly` com o prefixo `cvpilot` (em HTTPS, `__Secure-cvpilot.session_token`);
  - o `authPlugin` valida a sessão em toda rota fora de `/health` e `/auth`, e responde 401 sem ela.
- **O bypass `AUTH_DEV_BYPASS` e o cabeçalho `x-dev-user-id` saíram.**
  - No dev, `pnpm db:seed` dá ao usuário do seed (`dev@cvpilot.local`) a senha de `DEV_USER_PASSWORD`.
  - Os testes de integração se cadastram pela própria rota de login.
- **A `BETTER_AUTH_URL` já traz o caminho do login:** `http://localhost:4000/auth` no dev e `https://<domínio>/api/auth` em produção. O Better Auth casa as rotas por esse caminho, e o handler remonta a URL a partir dela, porque o Caddy tira o `/api` antes de a requisição chegar à API.
- **O web não usa o cliente do Better Auth:** chama as rotas JSON pelo `api()` que já existe. O middleware do Next só confere se o cookie de sessão existe, para mandar à tela de login; quem valida a sessão é a API.

## Consequências

- **Criar uma conta é lento de propósito** (o scrypt leva centenas de milissegundos). Os testes de integração têm 30 s de limite.
- **O rate limit do Better Auth fica em memória.** Serve para uma réplica da API; com várias, precisa de armazenamento compartilhado.
- **Login com Google (RF-01)** é configuração do Better Auth (`socialProviders`), quando houver o OAuth client.
- **Verificação de e-mail e recuperação de senha** entram junto com o envio de e-mail.
