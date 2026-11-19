---
name: tela-web
description: Cria ou altera telas do frontend do CV Pilot (apps/web, Next.js App Router + Mantine 8 + TanStack Query). Cobre páginas, formulários validados com os schemas Zod de contracts, hooks de dados, mutações com notificação, estados de carregando, vazio e erro, acessibilidade e textos em pt-BR. Use ao construir uma página, componente, formulário, kanban, filtro ou qualquer mudança visual ou de fluxo na interface.
---

# Telas do frontend (Next.js + Mantine)

## Onde cada coisa fica

| Caminho | Conteúdo |
|---|---|
| `src/app/<rota>/page.tsx` | A página (`'use client'`, como as atuais): só compõe componentes e hooks |
| `src/features/<dominio>/` | Formulários, componentes e hooks do domínio (ex.: `SearchProfileForm.tsx`) |
| `src/features/shared/queries.ts` | Queries compartilhadas (`useSources`, `useResumes`...) e `useApiMutation` |
| `src/lib/api.ts` | Cliente HTTP (`api<T>(path, init)`, lança `ApiError` com o código do erro na `message`). Manda o cookie da sessão; 401 leva para `/login` e 403 `consent_required` para `/aceite` |
| `src/lib/session.ts` | Entrar, cadastrar, sair, trocar a senha e excluir a conta (rotas `/auth/*` do Better Auth) e as mensagens de erro do login |
| `src/lib/routes.ts` | Rotas públicas (`isPublicPath`), páginas sem menu (`isBarePath`) e `safeNextPath` para o `?next=` do login |
| `src/middleware.ts` | Sem o cookie da sessão, manda para `/login?next=...` (a API confere a sessão de verdade) |
| `src/lib/form-values.ts` | `textOrNull` e `numberOrNull`: campo vazio do formulário vira `null` na API |
| `src/lib/labels.ts` | Rótulos em pt-BR para os valores dos enums |
| `src/app/shell.tsx` | Menu lateral: inclua a rota nova em `links`. O contador de alertas não lidos fica ao lado de "Alertas" |

Referência completa: [search-profiles/page.tsx](../../../apps/web/src/app/search-profiles/page.tsx) + [SearchProfileForm.tsx](../../../apps/web/src/features/search-profiles/SearchProfileForm.tsx).

## Dados

- Leitura: `useQuery({ queryKey: ['recurso', ...params], queryFn: () => api<T>('/recurso') })`. A chave começa pelo nome do recurso, para que a invalidação funcione.
- Escrita: `useApiMutation({ path, method, invalidate: ['recurso'], success: 'Mensagem em pt-BR' })`. O erro já vira notificação; não duplique esse tratamento.
- Tipos: use os de `@cv-pilot/contracts`. `src/lib/types.ts` só guarda formatos de resposta que ainda não estão nos contratos. Ao criar um tipo de resposta novo, prefira colocá-lo em `contracts` (item 19 de `docs/melhorias.md`).
- O `web` importa **só `@cv-pilot/contracts`**. Regra de negócio fica na API e no `core`, não no componente.
- Página nova que não exige login (como `/termos`) entra em `PUBLIC_PATHS` no `routes.ts`, com teste em `routes.test.ts`. Toda outra página já exige sessão e termos aceitos.
- Erro da API com código conhecido vira texto em pt-BR num mapa local (`APPLY_ERRORS`, `UPDATE_ERRORS`, `UPLOAD_ERRORS`), nunca o código cru.
- A API devolve as ações possíveis quando a regra é do servidor (ex.: `allowedTransitions` no kanban): a tela mostra só o que vem ali, sem repetir a regra.

## Formulários

- `@mantine/form` com `initialValues` tipado pelo `Input` do contrato e validação **com o mesmo schema Zod da API**, como em `SearchProfileForm`: `safeParse` → `issues` → mapa de erros por campo.
- `Select` trabalha com string: converta para número ao ler e ao gravar.
- Botão de envio com `loading={mutation.isPending}`. Feche o modal e resete o formulário no `onSuccess`.
- Criar e editar usam o mesmo formulário: ele recebe o item opcional e escolhe `POST` ou `PUT` (`SearchProfileForm`, `SendRuleForm`). Duplicar é criar com os valores de outro item.
- Lista editável dentro do formulário (respostas padrão): `form.insertListItem`, `form.removeListItem` e `key={form.key(...)}`, como em `SendRuleForm`.
- O conteúdo do `Modal` só monta quando ele abre (`initialValues` valem a cada abertura). Formulário que precisa sobreviver à troca de passo de um `Stepper` fica fora dos filhos dele, como no `Onboarding`.
- Ação destrutiva (excluir, desativar fonte) pede confirmação num `Modal` que diz o que acontece depois (modelos de carta, regras de envio; excluir a conta também pede a senha).

## Interface

- Só **Mantine** + ícones `@tabler/icons-react`. Não adicione outra biblioteca de UI.
- Toda lista tem três estados: **carregando** (`Loader`/`Skeleton`), **vazio** com o próximo passo ("Nenhum perfil ainda. Crie o primeiro para os bots começarem a buscar.") e **erro**.
- Textos em pt-BR, curtos e no tom das telas atuais. Rótulo de enum sempre via `labels.ts`. Valor novo no enum de `contracts` = rótulo novo no `labels.ts`.
- Responsivo: `SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}`. Confira a largura de celular (o menu vira um burger).
- Acessibilidade:
  - todo input tem `label`;
  - botão só com ícone (`ActionIcon`) tem `aria-label`;
  - cor nunca é o único sinal (a nota mostra o número além da cor).
- Nada de segredo em `NEXT_PUBLIC_*`: essas variáveis vão para o bundle e são fixadas no build.

## Testes

- Funções puras (formatação, mapeamento): Vitest.
- Componentes e fluxos: veja a seção `apps/web` da skill `testes`.

## Checklist

- [ ] Página fina; lógica de domínio em `features/` e regras na API/`core`
- [ ] Tipos de `contracts`; validação com o mesmo schema da API
- [ ] Estados de carregando, vazio e erro; confirmação nas ações destrutivas
- [ ] Rótulos em `labels.ts`; textos em pt-BR; `aria-label` nos botões de ícone
- [ ] Rota incluída no `shell.tsx` (se for página nova)
- [ ] Testada na largura de celular
- [ ] Testada no navegador logado: com o painel do navegador escondido, os modais do Mantine não abrem (a transição espera um quadro de animação), então mostre o painel antes de testar cliques
