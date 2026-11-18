# Extensão do navegador (modo assistido)

Fase 2 do PRD. Extensão Chrome (Manifest V3, TypeScript) que:

1. lê as candidaturas com status `needs_action` da API;
2. abre a vaga no navegador do próprio candidato;
3. preenche o formulário com o currículo, a carta e as respostas da regra de envio do site;
4. **o candidato revisa e clica em enviar**;
5. informa a API que a candidatura foi enviada.

É o único modo usado em portais que proíbem automação (ex.: LinkedIn).
