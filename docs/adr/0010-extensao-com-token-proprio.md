# ADR 0010: Extensão do navegador com token próprio e preenchimento sob pedido

- **Status:** aceita
- **Data:** 2026-11-20

## Contexto

O modo assistido (RF-50) é o único permitido nos portais que proíbem automação, e é onde termina toda candidatura que encontra um bloqueio (RF-53). Até aqui, a candidatura chegava em "Ação necessária" e o candidato copiava a carta à mão. A extensão Chrome (Manifest V3) do PRD fecha esse caminho: lista o que espera o candidato, abre a vaga e preenche o formulário, e o candidato revisa e envia.

Três decisões tinham alternativas:

- **Autenticação.** A extensão poderia reaproveitar o cookie de sessão do site. Mas o cookie é `httpOnly`, vale para a conta inteira e depende de regras de `SameSite` que mudam entre versões do Chrome. Um token próprio pode ter escopo menor e ser revogado por navegador.
- **Endereço da API.** Uma extensão MV3 só chama hosts listados em `host_permissions`, fixos no manifesto ou pedidos ao usuário em tempo de uso. O pedido em tempo de uso mostra uma janela que o E2E não consegue aceitar.
- **Quando preencher.** Um content script declarado no manifesto rodaria em toda página aberta. Injetar só quando o candidato pede deixa claro quando a extensão age.

## Decisão

- **Token próprio, só para `/extension`.**
  - O candidato gera a chave em "Minha conta" (`POST /extension-tokens`), dá um nome ao navegador e cola o token na extensão. O token (`cvp_ext_` + 256 bits aleatórios) aparece uma vez; o banco guarda só o SHA-256 (`ExtensionToken.tokenHash`) e o começo, para a lista. Até 5 por conta.
  - O `authPlugin` aceita **só** o token nas rotas `/extension/*` e **só** o cookie nas demais. Um token vazado lê o perfil base e as candidaturas em "Ação necessária", baixa o currículo delas e as marca como enviadas, e nada mais.
  - O aceite dos termos continua valendo: sem ele, a extensão recebe 403 `consent_required`.
  - Desconectar (apagar a chave) corta a extensão na hora. `lastUsedAt` é gravado no máximo a cada 5 min.
- **Rotas da extensão:** `GET /extension/me`, `GET /extension/applications` (em "Ação necessária", com a página da vaga no site de origem), `GET /extension/applications/:id/resume` (o arquivo decifrado, `no-store`) e `POST /extension/applications/:id/sent`, que usa a mesma máquina de estados do kanban e agora grava `sentAt`. As respostas seguem os schemas de `contracts`, e a extensão os valida.
- **API fixada no build.** `CV_PILOT_API_URL` entra no bundle e no `host_permissions` do manifesto, como o `NEXT_PUBLIC_API_URL` do web. O E2E gera uma cópia apontando para a API de teste.
- **Preenchimento só sob pedido, nunca o envio.**
  - O popup chama a API: páginas de extensão com `host_permissions` não passam pelo CORS. O script injetado na vaga nunca fala com a API.
  - "Abrir vaga" abre a aba pelo service worker e guarda qual aba é de qual candidatura (`chrome.storage.session`), porque o popup fecha quando a aba nova ganha o foco.
  - "Preencher" injeta `fill.js` na aba da vaga (`chrome.scripting`) e manda os dados por mensagem. O script só escreve em campos vazios, marca o que preencheu e anexa o currículo ao campo de arquivo. **Nunca clica em enviar** (RF-53).
  - A escolha do valor de cada campo é uma função pura (`matchField`): as respostas padrão da regra de envio vêm antes do perfil, a carta só vai em área de texto, e senha, escolhas e "nome da empresa" ficam de fora.
- **Permissões:** `storage`, `scripting`, o host da API e `https://*/*`. O acesso amplo é o que permite preencher em qualquer ATS. Como não há content script declarado, a extensão só toca numa página quando o candidato clica em "Preencher".

## Consequências

- **O modo assistido funciona de ponta a ponta**, sem automação no site da vaga: quem envia é sempre o candidato. Nenhum operador novo de dados pessoais entra; os termos já dizem que os dados vão ao site de vagas só quando a candidatura é enviada. O `TERMS_VERSION` não muda.
- **A extensão não está na Chrome Web Store.** Por enquanto, ela é instalada sem empacotar (`chrome://extensions`, "Carregar sem compactação") a partir do `dist/`, gerado com o endereço da API de produção. Publicar exige ícones, política de privacidade da extensão e a revisão do `https://*/*` pela loja.
- **O preenchimento é por rótulo.** Formulários sem `<label>` nem `aria-label`, ou dentro de iframes de outro domínio, ficam sem preencher, e o resumo diz quantos obrigatórios sobraram. Perguntas novas não são guardadas: o banco de respostas (§3.2 de `docs/melhorias.md`) é o próximo passo.
- **Sem "salvar vaga de qualquer site" ainda.** A extensão só lê as candidaturas que o CV Pilot já criou.
- **O E2E carrega a extensão de verdade** num Chromium completo (`channel: 'chromium'`), com a página da vaga servida pelo próprio teste.
