# ADR 0004: Fontes HTML lidas por listagem completa, com o detalhe só das vagas novas

- **Status:** aceita
- **Data:** 2026-11-19

## Contexto

A Nerdin e o ProgramaThor ([fichas](../fontes/README.md)) são os primeiros sites sem API:

- a vaga só existe em HTML;
- a listagem é paginada, e cada vaga tem uma página com um `JobPosting` em JSON-LD;
- nenhum dos dois busca por empresa nem tem uma busca por palavra-chave que valha a pena usar.

O contrato dos adapters tinha `fetchBy: 'board' | 'keyword'`, e a ingestão gravava cada vaga a partir de uma resposta só. Nessas fontes, o card da listagem não traz a descrição. Baixar a página de cada vaga toda hora seria caro para o site: a Nerdin tinha cerca de 900 vagas em 44 páginas.

## Decisão

- **`fetchBy: 'feed'`.** A listagem inteira da fonte é um alvo único. O `planIngestion` gera um alvo por fonte (`{ sourceId }`) quando algum perfil vencido usa essa fonte, e o job de ingestão tem o id `ingest_<fonte>_feed_<janela>`.
- **`detail` opcional no adapter.** Ele tem duas partes: `idOf`, que lê o id da vaga já na listagem, e `fetch`, que baixa a página da vaga.
  - A ingestão só chama o `detail.fetch` quando a fonte ainda não tem a vaga aberta.
  - Das vagas conhecidas, ela só renova o `lastSeen`.
- **Expiração (RF-34).** A listagem completa prova a ausência como um board inteiro prova: a vaga que não veio é encerrada. A regra é a mesma, por fonte (`closeMissing({ sourceId })`) em vez de por board. Com a lista cortada no teto de 1.000 vagas, nada é encerrado.
- **O card e o JSON-LD se completam** (`normalizeListedJob`):
  - contrato, nível e modelo vêm do card, que o site escreve por extenso ("PJ • Pleno • Híbrido");
  - título, empresa, descrição, salário e data vêm do JSON-LD;
  - termo ambíguo ("CLT, PJ") fica `null`;
  - "Home Office" no lugar da cidade é o modelo `remote`, não um endereço.
- **Cheerio** (`cheerio@1.2.0`) para ler o HTML, como a skill `adapter-vagas` já previa, e Zod para validar o JSON-LD antes de usar.
- **Leitura comum** em `packages/adapters/src`: `json-ld.ts`, `listing-terms.ts` e `listed-job.ts`. Cada adapter só sabe ler a própria listagem.

## Consequências

- **Primeira leitura longa.** Ela baixa o detalhe de todas as vagas. Com 20 requisições por minuto, a Nerdin leva uns 45 minutos, dentro da janela de 1 h. Depois disso, cada rodada só pede as páginas da listagem e as vagas novas.
- **Mudança no texto de uma vaga que continua aberta não é vista**, porque a página dela não é baixada de novo. É a troca aceita para não reler centenas de páginas por hora. Se a vaga fechar e reabrir, ela é lida inteira outra vez.
- **Página sem `JobPosting`** gera um aviso no log, e a vaga entra só com os dados do card, sem descrição. Se o site tirar o JSON-LD, o match perde qualidade, mas a ingestão não quebra; o admin mostra a fonte.
- **Outros sites HTML** reaproveitam `paginateListing`, `listedJobDetail` e `normalizeListedJob`. Basta escrever o parser da listagem.
