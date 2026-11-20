# Solides Vagas

| Campo              | Valor                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Id do adapter      | `solides`                                                                    |
| URL base           | https://vagas.solides.com.br · MCP: https://mcp.solides.com.br/ats/candidate |
| Decisão            | **coletado**, pelo MCP oficial                                               |
| `kind` / `fetchBy` | `api` (MCP) · `keyword`, com `detail` para a descrição inteira               |
| Modos de envio     | `assisted`                                                                   |
| Rate limit adotado | 30 requisições por minuto (a Solides não publica limite)                     |
| Consultado em      | 2026-11-19 (MCP testado em 2026-11-20)                                       |

A Solides é ATS e portal ao mesmo tempo: as vagas são das empresas clientes, hospedadas nela. Às vezes ficam também numa página de carreiras própria (`<empresa>.vagas.solides.com.br`).

## robots.txt

- https://vagas.solides.com.br/robots.txt: para `User-agent: *`, `Allow: /`. O Googlebot tem regras próprias, sem efeito para nós. Sem `Crawl-delay`.
- `mcp.solides.com.br/robots.txt` responde 404: nenhuma regra (RFC 9309).

## Termos de uso

- Portal: https://solides.com.br/politica-de-privacidade/. Não fala de scraping, bots ou coleta automatizada. A cláusula 15 veda a cópia de marcas e do conteúdo das telas, não o acesso.
- MCP: a página https://solides.com.br/lp/mcp-solides-vagas/ é de divulgação e **não tem termos próprios**.
  - Diz que a conexão é gratuita e não exige login.
  - Diz que o MCP serve para consultar as vagas públicas do portal e que a candidatura é feita no portal.
  - Não fala de limites, uso comercial, agregadores, armazenamento ou atribuição.
- **Silêncio, não permissão expressa.** Antes de produção, vale confirmar com a Solides o uso por um agregador.

## Dados públicos: o MCP

Servidor MCP por HTTP (`solides-mcp` 1.4.0, protocolo `2025-06-18`), sem login. Ele se apresenta como "descoberta de vagas do portal vagas.solides.com.br", só de leitura e sem dados do candidato.

- **Sessão:**
  - o `initialize` devolve o cabeçalho `mcp-session-id`;
  - depois vêm `notifications/initialized` e `tools/call` com esse cabeçalho;
  - as respostas chegam como JSON ou como SSE (`event: message` / `data: {...}`).
- **`buscar_vagas`** (`title`, `page` a partir de 1 e `take` até 50, além de filtros de local, modalidade, senioridade, contrato e área).
  - O resultado é um texto JSON com `total_vagas`, `total_paginas` e `vagas[]`.
  - Cada vaga traz `id`, `titulo`, `empresa`, `local` (`Cidade/UF`), `modalidade` (`presencial|remoto|hibrido`), `senioridade`, `contrato`, `salario` (texto, "Não informado" quando falta), `publicado_em` (`AAAA-MM-DD`), `link_candidatura` e `descricao` **truncada**.
- **`detalhar_vaga`** (`id`): os mesmos campos com a **descrição inteira**.
  - O `link_candidatura` do detalhe veio quebrado no teste (`https://supporte./vacancies/...`). Use o da busca.
- Também existem `buscar_vagas_por_perfil`, `contar_vagas`, `monitorar_vagas` e `buscar_localidades`, que o adapter não usa.

## Candidatura

No portal da Solides, com cadastro do candidato. Só assistida. A própria página do MCP diz que a IA não se candidata.

## Como construir o adapter

1. Cliente MCP mínimo no adapter, usando `ctx.http` (User-Agent, intervalo e `robots.txt`): `initialize` → `notifications/initialized` → `tools/call`. Leia JSON e SSE. Sem SDK.
2. `fetchBy: 'keyword'`: cada palavra-chave dos perfis vira um `buscar_vagas` com `take: 50`, paginado até `ctx.maxResults`.
3. `detail`: o `detalhar_vaga` só para as vagas novas, como no Nerdin. Ele traz a descrição inteira.
4. `normalize`: `externalId` = `id`; `url` = `link_candidatura` da busca; `modalidade` vira `workModel`, `senioridade` vira `seniority` e `contrato` vira `contractType`. Na dúvida, `null`.
5. `recognize`: `<empresa>.vagas.solides.com.br` e `vagas.solides.com.br` são `covered`, porque a busca já lê todas as empresas.
6. Registrar num ADR: é o primeiro adapter por MCP.

## Pendências

- [ ] Confirmar com a Solides o uso por um agregador (antes de produção).
