# Solides Vagas

| Campo              | Valor                                                       |
| ------------------ | ----------------------------------------------------------- |
| Id do adapter      | `solides`                                                   |
| URL base           | https://vagas.solides.com.br                                |
| Decisão            | **investigar** (promissor)                                  |
| `kind` / `fetchBy` | `api` (MCP oficial) ou `html` · `keyword` (busca por cargo) |
| Modos de envio     | `assisted`                                                  |
| Rate limit adotado | a definir com o canal escolhido                             |
| Consultado em      | 2026-11-19                                                  |

A Solides é ATS e portal ao mesmo tempo: as vagas são das empresas clientes, hospedadas nela. Às vezes ficam também numa página de carreiras própria (`<empresa>.vagas.solides.com.br`).

## robots.txt

https://vagas.solides.com.br/robots.txt

- Para `User-agent: *`, `Allow: /`.
- O Googlebot tem regras próprias: a raiz de empresa (`/empresa/*$`) é bloqueada para ele, as vagas não.
- Sem `Crawl-delay`. `Sitemap: https://www.vagas.solides.com.br/sitemap.xml`.

## Termos de uso

O rodapé aponta para https://solides.com.br/politica-de-privacidade/.

- O documento não fala de scraping, bots ou coleta automatizada.
- A cláusula 15 veda o uso indevido ou a cópia de marcas e do conteúdo das telas. É sobre cópia de conteúdo, não sobre acesso automatizado.

## Dados públicos

- **MCP público oficial:** https://solides.com.br/lp/mcp-solides-vagas/.
  - Endpoint `https://mcp.solides.com.br/ats/candidate`, por HTTP e sem login.
  - Busca vagas públicas por cargo, local e preferências. Foi feito para assistentes de IA.
  - Não acessa dados do candidato e **não se candidata**: a candidatura é feita no portal.
  - É o canal mais legítimo para a descoberta, porque é oferecido pela própria Solides. As tools e o esquema não foram listados.
- HTML (Next.js), com listagens públicas em:
  - `/vagas/todas`, `/vagas/todas/{UF}` e `/vagas/todas/{cidade-uf}`;
  - `/vagas/area/{area}/todas`;
  - `/vagas/todas/remoto`.
- **A listagem não tem JSON-LD** (HTML cru conferido: nenhum bloco `application/ld+json`). Os dados vêm do cliente, provavelmente de uma API interna não documentada.
- Não há API REST pública documentada, nem para as páginas de carreira por empresa.

## Candidatura

No portal da Solides, com cadastro do candidato. Só assistida.

## Como construir o adapter

Opção preferida: o **MCP oficial**.

1. Listar as tools do servidor (`tools/list`) e ver os parâmetros de busca e o formato da resposta.
2. Ler os termos de uso do MCP. A página não os mostra: perguntar à Solides se o uso por um agregador é permitido.
3. `fetchBy: 'keyword'`: cada palavra-chave normalizada dos perfis vira uma busca no MCP, como na Gupy.
4. O cliente MCP fica num módulo do adapter, usando `ctx.http` para respeitar o User-Agent e o intervalo por host. Evite trazer um SDK inteiro só para isso.

Alternativa: o HTML com o sitemap. O `robots.txt` permite, mas sem JSON-LD seria preciso ler a API interna do Next.js, o que é frágil e não documentado. Só use se o MCP não servir.

## Pendências antes de codar

- [ ] Listar as tools e o esquema do MCP.
- [ ] Confirmar os termos de uso do MCP para um agregador.
- [ ] Ver se a página de detalhe da vaga (não a listagem) tem JSON-LD.
- [ ] Registrar a escolha (MCP × HTML) num ADR, porque é o primeiro adapter por MCP.
