# ADR 0008: Solides pelo servidor MCP oficial, com cliente próprio

- **Status:** aceita
- **Data:** 2026-11-20

## Contexto

A Solides Vagas é ATS e portal: as vagas de milhares de empresas clientes ficam em `vagas.solides.com.br`. Para coletar, havia dois caminhos ([ficha](../fontes/solides.md)):

- **O HTML do portal.** O `robots.txt` permite, mas a listagem não tem JSON-LD. Os dados vêm de uma API interna do Next.js, sem documentação.
- **O servidor MCP público da própria Solides** (`mcp.solides.com.br/ats/candidate`). Foi feito para assistentes de IA buscarem vagas públicas, sem login e só de leitura. Tem as tools `buscar_vagas` (por cargo, paginada, até 50 por página) e `detalhar_vaga` (a descrição inteira).

## Decisão

- **Coletar pelo MCP.** É o canal que a própria Solides oferece para essa finalidade e tem formato estável e descrito pelas tools. Ler a API interna do portal seria frágil.
- **`fetchBy: 'keyword'`**, como a Gupy: cada palavra-chave dos perfis vira um `buscar_vagas`, paginado até o teto da execução.
- **`detail` pelo `detalhar_vaga`**, só para as vagas novas ([ADR 0004](0004-fontes-html-feed-e-detalhe.md)). A busca traz a descrição cortada, e o match e o "o que falta" precisam dela inteira. O link de candidatura continua o da busca, porque o do detalhe veio quebrado no teste.
- **Cliente MCP próprio, sem SDK** ([mcp.ts](../../packages/adapters/src/solides/mcp.ts)):
  - faz o `initialize`, o `notifications/initialized` e o `tools/call` por HTTP;
  - lê a resposta em JSON ou em SSE;
  - tudo passa pelo `ctx.http`, com o `robots.txt`, o User-Agent do bot e o intervalo por host;
  - abre uma sessão por execução (a busca e os detalhes do mesmo job a reaproveitam) e a reabre uma vez se ela expirar (404).
- **30 requisições por minuto**, porque a Solides não publica limite.
- O `recognize` marca `vagas.solides.com.br` e `<empresa>.vagas.solides.com.br` como `covered` no "Adicionar empresa" ([ADR 0007](0007-adicionar-empresa-detector-de-ats.md)).

## Consequências

- Mais um site grande no CV Pilot, coletado pelo canal oficial.
- **Uso por agregador não confirmado.** A página do MCP não tem termos próprios e não fala de agregadores, uso comercial ou republicação. Antes de produção, é preciso confirmar com a Solides. A fonte pode ser desligada no admin sem deploy.
- **Sem SDK, o cliente cobre só o necessário.** Se o servidor passar a exigir algo do protocolo que o cliente não faz (autenticação, outra versão), a busca falha, o `SourceRun` registra o erro e a fonte aparece como falhando no admin.
- Cada vaga nova custa uma chamada a mais (o detalhe). Com 50 vagas por página e o detalhe só das novas, a primeira leitura de uma palavra-chave é a mais cara; as seguintes, não.
