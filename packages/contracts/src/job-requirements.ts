// zod/v4: o mesmo schema pede a extração ao Claude (o helper do SDK só aceita v4) e valida a
// saída antes de gravar, como o ParsedResume.
import { z } from 'zod/v4';

/** Um requisito que dá para conferir no texto do currículo (RF-41). */
export const JobRequirement = z.object({
  name: z
    .string()
    .describe('nome curto e usual: "JavaScript", "Inglês", "AWS", "Ciência da Computação"'),
  aliases: z
    .array(z.string())
    .describe(
      'outras formas de escrever o mesmo requisito: siglas, grafias em inglês ou português',
    ),
  required: z.boolean().describe('true se a vaga exige; false se é diferencial ou desejável'),
});
export type JobRequirement = z.infer<typeof JobRequirement>;

/** Requisitos extraídos de uma vaga, gravados em `Job.requirements`. */
export const JobRequirements = z.object({ requirements: z.array(JobRequirement) });
export type JobRequirements = z.infer<typeof JobRequirements>;

/**
 * O que falta para a vaga, comparando os requisitos com o currículo do candidato.
 * `not_analyzed`: os requisitos da vaga ainda não foram extraídos.
 * `no_resume`: o candidato não tem currículo lido para comparar.
 */
export type RequirementsCheck =
  | { status: 'not_analyzed' }
  | { status: 'no_resume' }
  | { status: 'ready'; missing: JobRequirement[]; met: JobRequirement[] };
