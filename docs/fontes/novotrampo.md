# Novo Trampo (TOTVS Atração de Talentos)

| Campo              | Valor                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Id do adapter      | `totvs` (o ATS por trás, não o portal)                                               |
| URL base           | https://www.novotrampo.com.br (portal) · https://atracaodetalentos.totvs.app (vagas) |
| Decisão            | **investigar**                                                                       |
| `kind` / `fetchBy` | a definir · `board` (uma empresa por vez)                                            |
| Modos de envio     | `assisted`                                                                           |
| Rate limit adotado | a definir                                                                            |
| Consultado em      | 2026-11-19                                                                           |

O Novo Trampo é o portal agregador da plataforma "Atração de Talentos" da TOTVS. As vagas moram em `atracaodetalentos.totvs.app/<empresa>/...`. Um adapter faria sentido no ATS (por empresa), não no portal.

## robots.txt

- https://www.novotrampo.com.br/robots.txt:
  - só tem um grupo, para `User-Agent: Grapeshot`;
  - não há regra para `User-agent: *`, o que significa nenhuma restrição geral;
  - `Sitemap: https://www.novotrampo.com.br/sitemap.xml`.
- O `robots.txt` de `atracaodetalentos.totvs.app` não foi verificado.

## Termos de uso

PDF: https://centraldocandidato.totvs.app/assets/files/terms-of-use/novo-trampo/v1.pdf ("Termos de uso do NOVOTRAMPO v1 04.02.2025").

**Não lido**: o PDF veio comprimido na pesquisa. Ler antes de qualquer código.

## Dados públicos

- Listagem no portal: `https://www.novotrampo.com.br/vagas/N`.
- Vaga: `https://atracaodetalentos.totvs.app/<empresa-slug>/<id>/<slug-da-vaga>`.
- As imagens vêm de `.../<empresa>/api/images/<uuid>`. Isso sugere uma API por empresa, não documentada.
- JSON-LD, API pública e RSS: não verificados.

## Candidatura

Pela Central do Candidato da TOTVS (`centraldocandidato.totvs.app`), com cadastro reutilizável e às vezes "candidatura simplificada". Exige conta. Só assistida.

## Como construir o adapter

1. Ler os termos (PDF).
2. Verificar o `robots.txt` de `atracaodetalentos.totvs.app`.
3. Abrir uma página de vagas de uma empresa e procurar JSON-LD ou uma rota JSON da lista de vagas.
4. Se as três verificações passarem, `fetchBy: 'board'`, com `CareerBoard.token` = slug da empresa.

## Pendências antes de codar

- [ ] Ler os termos de uso.
- [ ] `robots.txt` de `atracaodetalentos.totvs.app`.
- [ ] Fonte de dados por empresa (JSON-LD ou JSON).
