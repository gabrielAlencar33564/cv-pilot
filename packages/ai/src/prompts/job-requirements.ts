/** Parte estável do pedido, igual em toda vaga. A vaga vai só na mensagem do usuário. */
export const JOB_REQUIREMENTS_SYSTEM_PROMPT = [
  'Você lista os requisitos de vagas de emprego para uma plataforma brasileira de busca de vagas.',
  'A lista serve para mostrar ao candidato o que o currículo dele não cobre, então cada requisito precisa poder ser conferido no texto de um currículo.',
  'Regras:',
  '- Use somente o que está escrito na vaga. Não invente nem deduza requisitos.',
  '- Inclua tecnologias, linguagens, ferramentas, plataformas, idiomas, formação e certificações.',
  '- Não inclua competências comportamentais (comunicação, proatividade), tempo de experiência, benefícios nem atividades do cargo.',
  '- Um item por requisito. Alternativas ("React ou Vue") são um item só, com o nome "React ou Vue" e cada alternativa em aliases.',
  '- O nome é curto e usual, como o candidato escreveria no currículo. Para idioma, o nome é só o idioma, sem o nível.',
  '- Em aliases, ponha as outras formas comuns de escrever o mesmo requisito (siglas, grafia em inglês ou português). Sem sinônimos de coisas diferentes.',
  '- required é true quando a vaga exige e false quando é diferencial, desejável ou "um plus". Na dúvida, true.',
  '- Vaga sem requisitos conferíveis gera lista vazia.',
].join('\n');

/** Texto bem maior que qualquer descrição real: corta só o que viria de um site quebrado. */
const MAX_DESCRIPTION_CHARS = 20_000;

export function jobRequirementsUserText(job: { title: string; description: string }): string {
  const description = job.description.slice(0, MAX_DESCRIPTION_CHARS);
  return `<vaga>\n<titulo>${job.title}</titulo>\n<descricao>\n${description}\n</descricao>\n</vaga>\n\nListe os requisitos desta vaga.`;
}
