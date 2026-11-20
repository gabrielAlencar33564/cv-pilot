# ADR 0006: "O que falta" com requisitos extraídos pela IA e comparação sem IA

- **Status:** aceita
- **Data:** 2026-11-19

## Contexto

O RF-41 pede mostrar, em cada vaga, o que o candidato tem e o que falta. As habilidades em comum já saem do match ([ADR 0005](0005-matching-semantico-sob-demanda.md)), cruzando as habilidades do currículo com o texto da vaga. O caminho contrário, os requisitos da vaga que o currículo não mostra, exige saber quais são os requisitos de cada vaga, e as fontes não os entregam estruturados.

Havia dois caminhos:

- **Lista de habilidades no código.** Sem custo de IA, mas só enxerga o que está na lista. Deixa de fora idiomas, formação e certificações, não distingue o que é exigido do que é diferencial e vira manutenção eterna.
- **Extração pelo Claude.** Entende qualquer requisito e a diferença entre exigido e diferencial, mas custa uma chamada por vaga.

## Decisão

- **A IA extrai, mas não compara.**
  - `AiProvider.extractJobRequirements` recebe só o título e a descrição da vaga e devolve `{ name, aliases, required }` por requisito (`JobRequirements` de `contracts`, com saída estruturada).
  - O prompt pede só o que dá para conferir no texto de um currículo: tecnologias, ferramentas, idiomas, formação e certificações. Ficam de fora competências comportamentais, tempo de experiência e benefícios.
- **Comparação sem IA.** `requirementsCheck`, função pura do `core`, procura o nome ou um dos sinônimos por termo inteiro no currículo (resumo, habilidades, experiências, formação e idiomas). A IA nunca afirma que o candidato tem ou não tem algo (regra 4 do produto). O erro possível é um requisito aparecer como faltando sem faltar, e a tela avisa que a comparação é pelo texto.
- **Uma extração por texto de vaga, vale para todos os usuários.**
  - O resultado é gravado em `Job.requirements`.
  - A ingestão volta a coluna para null quando o título ou a descrição mudam.
  - O id do job (`requirements_{vaga}_{hash do texto}`) impede repetir o mesmo texto, inclusive depois de uma falha definitiva.
- **Só para as vagas que valem a pena.** O `match` pede a extração (fila `job-requirements`) quando a nota passa da nota mínima do perfil e a vaga ainda não tem requisitos.
- **Comparação na leitura.** `GET /jobs/:id` cruza os requisitos com o mesmo currículo que o match usa (`comparisonResumeVersion`: o da regra de envio ou o último lido). Trocar de currículo não pede nova chamada à IA.
- **Modelo:** `claude-opus-5-5` com esforço `low`, como manda a skill até um modelo menor ser medido.

## Consequências

- **Sem operador novo de dados pessoais.** A extração manda só o texto da vaga ao Claude, que já está nos termos. O `TERMS_VERSION` não muda.
- **Custo proporcional às vagas relevantes**, não ao volume da ingestão nem ao número de usuários. Uma vaga que passa da nota mínima de vários perfis é extraída uma vez.
- **Vaga abaixo da nota mínima de todos os perfis não tem "o que falta".** A tela diz que a análise é feita para as vagas que passam da nota mínima.
- **Com o `noop` (dev, E2E e CI), nada é extraído.** O E2E grava os requisitos direto no banco para testar a tela.
- **Sinônimos dependem da IA.** Se ela esquecer uma grafia que o candidato usou, o requisito aparece como faltando. Melhora com o prompt, sem mudar a arquitetura.
- **Fica para depois:** o agregado "aprender X abriria +N vagas" (§4 de `docs/melhorias.md`), que pode reaproveitar os requisitos gravados.
