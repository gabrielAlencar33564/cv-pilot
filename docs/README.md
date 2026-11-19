# Documentação do CV Pilot

| Documento                        | Para quê                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [PRD.md](PRD.md)                 | Requisitos do produto: problema, personas, requisitos funcionais e não funcionais, stack, arquitetura-alvo e roadmap |
| [visao-geral.md](visao-geral.md) | Retrato do código atual: serviços, pacotes, fluxo do pipeline, modelo de dados, API e cobertura do PRD               |
| [melhorias.md](melhorias.md)     | Problemas encontrados, melhorias técnicas, funcionalidades novas, riscos e plano de ação por etapas                  |
| [fontes/](fontes/README.md)      | Uma ficha por site de vagas: termos, `robots.txt`, dados públicos e se dá para coletar ou só no modo assistido       |

As regras para agentes de IA (e para quem programa no projeto) estão em [AGENTS.md](../AGENTS.md); os procedimentos por tipo de tarefa, em [.claude/skills/](../.claude/skills).

Convenções:

- Decisões de arquitetura novas viram um arquivo em `docs/adr/NNNN-titulo.md` (contexto, decisão, consequências).
- Cada site de vagas ganha uma página em `docs/fontes/<site>.md` com a base de uso (API pública, termos, `robots.txt`), os limites de requisição e as particularidades do adapter.
