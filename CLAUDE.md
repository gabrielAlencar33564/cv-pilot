@AGENTS.md

## Específico do Claude Code

- As regras do projeto estão no `AGENTS.md` importado acima. Edite as regras lá, não aqui.
- As skills de `.claude/skills/` aparecem como `/testes`, `/modulo-api`, `/banco-prisma` etc. e carregam sozinhas quando a tarefa casa com a descrição. Numa tarefa que cruza camadas (ex.: nova rota + tela + teste), carregue todas as que se aplicam.
- Este repositório tem índice CodeGraph (`.codegraph/`). Use `codegraph_explore` antes de grep/Read para entender código e, principalmente, para confirmar que um export não tem mais usos antes de removê-lo.
- Antes de concluir, rode `pnpm check` (leva cerca de 1 min; use `run_in_background` se precisar) e mostre o resultado. Não diga que passou sem ter rodado.
