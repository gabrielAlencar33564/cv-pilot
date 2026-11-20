# Extensão do navegador (modo assistido)

Extensão Chrome (Manifest V3, TypeScript) do modo assistido ([ADR 0010](../../docs/adr/0010-extensao-com-token-proprio.md) e [ADR 0011](../../docs/adr/0011-banco-de-respostas-e-vaga-salva.md)):

1. o candidato gera uma chave em **Minha conta → Extensão do navegador** e cola no popup;
2. o popup lista as candidaturas em **Ação necessária** (`GET /extension/applications`);
3. **Abrir vaga** abre a página da vaga numa aba;
4. **Preencher** escreve nos campos vazios o perfil base, a carta, as respostas padrão da regra de envio e as do **banco de respostas**, e anexa o currículo. As perguntas que ficaram sem resposta vão para o banco, e o candidato responde uma vez em **Banco de respostas**, no site;
5. **o candidato revisa e clica em enviar no site** (a extensão nunca envia);
6. **Marquei como enviada** leva a candidatura para "Enviada" no CV Pilot.

É o único modo usado em portais que proíbem automação (ex.: LinkedIn).

## Código

| Arquivo                                            | O que faz                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [src/popup.ts](src/popup.ts)                       | Tela do popup: conectar com a chave, lista, abrir, preencher e marcar como enviada                           |
| [src/api.ts](src/api.ts)                           | Cliente das rotas `/extension`, com o token e as respostas validadas pelos contratos                         |
| [src/background.ts](src/background.ts)             | Service worker: abre a aba da vaga e injeta o preenchimento nela                                             |
| [src/fill.ts](src/fill.ts)                         | Script injetado na página da vaga: lê os campos, preenche os vazios e anexa o CV                             |
| [src/fill/match-field.ts](src/fill/match-field.ts) | Regra pura: que valor vai em cada campo, pelo rótulo, nome e `autocomplete`, e que campo vazio vira pergunta |

## Build e instalação

```bash
pnpm --filter @cv-pilot/extension build                 # dist/, apontando para http://localhost:4000
CV_PILOT_API_URL=https://<domínio>/api pnpm --filter @cv-pilot/extension build   # produção
```

O endereço da API fica no bundle e no `host_permissions` do manifesto. Para instalar, abra `chrome://extensions`, ligue o **Modo do desenvolvedor** e use **Carregar sem compactação** apontando para `apps/extension/dist`. Depois de um build novo, clique em recarregar na extensão.

## Testes

- `pnpm --filter @cv-pilot/extension test`: a regra dos campos, o cliente da API e os textos do popup.
- `pnpm test:e2e`: o fluxo inteiro com a extensão carregada no Chromium ([extensao.spec.ts](../e2e/tests/extensao.spec.ts)).
