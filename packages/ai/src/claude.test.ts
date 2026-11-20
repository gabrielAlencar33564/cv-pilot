import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeAiProvider } from './claude';
import { CoverLetterError, JobRequirementsError, ResumeParseError } from './types';

const curriculo = {
  summary: null,
  skills: ['TypeScript'],
  experiences: [],
  education: [],
  languages: [{ name: 'Inglês', level: 'avançado' }],
};

const resposta = (o: Record<string, unknown> = {}) => ({
  stop_reason: 'end_turn',
  parsed_output: curriculo,
  usage: { input_tokens: 1200, output_tokens: 300 },
  ...o,
});

/** Cliente falso: só o método que o provedor usa. */
function provedorCom(parse: ReturnType<typeof vi.fn>) {
  // em teste, o cast evita montar o cliente inteiro do SDK
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return new ClaudeAiProvider(client);
}

const umPdf = { kind: 'pdf' as const, data: new Uint8Array(Buffer.from('%PDF-1.7')) };

describe('ClaudeAiProvider.parseResume', () => {
  it('devolve o currículo validado e os tokens gastos', async () => {
    const provedor = provedorCom(vi.fn().mockResolvedValue(resposta()));

    await expect(provedor.parseResume(umPdf)).resolves.toEqual({
      resume: curriculo,
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
  });

  it('pede saída estruturada ao claude-opus-5-5, com o PDF antes do texto', async () => {
    const parse = vi.fn().mockResolvedValue(resposta());
    await provedorCom(parse).parseResume(umPdf);

    const pedido = parse.mock.calls[0]?.[0] as {
      model: string;
      fallbacks: unknown;
      output_config: { format: unknown };
      messages: { content: { type: string }[] }[];
    };
    expect(pedido.model).toBe('claude-opus-5-5');
    expect(pedido.fallbacks).toBe('default');
    expect(pedido.output_config.format).toBeDefined();
    expect(pedido.messages[0]?.content.map((b) => b.type)).toEqual(['document', 'text']);
  });

  it.each([
    ['refusal', 'refusal'],
    ['max_tokens', 'max_tokens'],
  ] as const)('stop_reason %s vira falha definitiva %s', async (stopReason, codigo) => {
    const provedor = provedorCom(vi.fn().mockResolvedValue(resposta({ stop_reason: stopReason })));

    await expect(provedor.parseResume(umPdf)).rejects.toMatchObject({ code: codigo });
  });

  it('saída fora do schema vira invalid_output, sem gravar dado parcial', async () => {
    const provedor = provedorCom(
      vi.fn().mockResolvedValue(resposta({ parsed_output: { skills: 'não é lista' } })),
    );

    await expect(provedor.parseResume(umPdf)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('pedido recusado pela API (400) não é repetido', async () => {
    const erro = new Anthropic.BadRequestError(400, undefined, 'pedido inválido', new Headers());
    const provedor = provedorCom(vi.fn().mockRejectedValue(erro));

    const falha = provedor.parseResume(umPdf);
    await expect(falha).rejects.toBeInstanceOf(ResumeParseError);
    await expect(falha).rejects.toMatchObject({ code: 'provider_rejected' });
  });

  it('limite de requisições (429) sobe como está, para o BullMQ repetir', async () => {
    const erro = new Anthropic.RateLimitError(429, undefined, 'devagar', new Headers());
    const provedor = provedorCom(vi.fn().mockRejectedValue(erro));

    await expect(provedor.parseResume(umPdf)).rejects.toBe(erro);
  });
});

describe('ClaudeAiProvider.extractJobRequirements', () => {
  const vaga = { title: 'Dev React', description: 'Exigimos React. Inglês é um plus.' };
  const requisitos = [
    { name: 'React', aliases: ['React.js'], required: true },
    { name: 'Inglês', aliases: ['English'], required: false },
  ];
  const respostaDeRequisitos = (o: Record<string, unknown> = {}) =>
    resposta({ parsed_output: { requirements: requisitos }, ...o });

  it('devolve os requisitos validados e os tokens gastos', async () => {
    const provedor = provedorCom(vi.fn().mockResolvedValue(respostaDeRequisitos()));

    await expect(provedor.extractJobRequirements(vaga)).resolves.toEqual({
      requirements: requisitos,
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
  });

  it('manda só o texto da vaga, com saída estruturada', async () => {
    const parse = vi.fn().mockResolvedValue(respostaDeRequisitos());
    await provedorCom(parse).extractJobRequirements(vaga);

    const pedido = parse.mock.calls[0]?.[0] as {
      model: string;
      output_config: { format: unknown };
      messages: { content: string }[];
    };
    expect(pedido.model).toBe('claude-opus-5-5');
    expect(pedido.output_config.format).toBeDefined();
    expect(pedido.messages[0]?.content).toContain('Exigimos React.');
  });

  it.each(['refusal', 'max_tokens'] as const)(
    'stop_reason %s vira falha definitiva',
    async (stopReason) => {
      const provedor = provedorCom(
        vi.fn().mockResolvedValue(respostaDeRequisitos({ stop_reason: stopReason })),
      );

      await expect(provedor.extractJobRequirements(vaga)).rejects.toMatchObject({
        code: stopReason,
      });
    },
  );

  it('saída fora do schema vira invalid_output', async () => {
    const provedor = provedorCom(
      vi.fn().mockResolvedValue(resposta({ parsed_output: { requirements: [{ name: 1 }] } })),
    );

    await expect(provedor.extractJobRequirements(vaga)).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });

  it('pedido recusado pela API (400) não é repetido; 429 sobe como está', async () => {
    const recusa = new Anthropic.BadRequestError(400, undefined, 'inválido', new Headers());
    const limite = new Anthropic.RateLimitError(429, undefined, 'devagar', new Headers());

    await expect(
      provedorCom(vi.fn().mockRejectedValue(recusa)).extractJobRequirements(vaga),
    ).rejects.toBeInstanceOf(JobRequirementsError);
    await expect(
      provedorCom(vi.fn().mockRejectedValue(limite)).extractJobRequirements(vaga),
    ).rejects.toBe(limite);
  });
});

describe('ClaudeAiProvider.writeCoverLetter', () => {
  const pedido = {
    job: { title: 'Dev React', company: 'Acme', description: 'Exigimos React.' },
    resume: curriculo,
    tone: 'formal' as const,
  };
  const carta =
    'Prezada equipe da Acme,\n\nTenho experiência com TypeScript.\n\nAtenciosamente,\n{{nome}}';
  const respostaDeCarta = (o: Record<string, unknown> = {}) =>
    resposta({ parsed_output: { body: `  ${carta}\n` }, ...o });

  it('devolve a carta sem espaços nas pontas e os tokens gastos', async () => {
    const provedor = provedorCom(vi.fn().mockResolvedValue(respostaDeCarta()));

    await expect(provedor.writeCoverLetter(pedido)).resolves.toEqual({
      body: carta,
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
  });

  it('manda a vaga e o currículo com saída estruturada, sem o nome do candidato', async () => {
    const parse = vi.fn().mockResolvedValue(respostaDeCarta());
    await provedorCom(parse).writeCoverLetter(pedido);

    const pedidoEnviado = parse.mock.calls[0]?.[0] as {
      model: string;
      system: string;
      output_config: { format: unknown };
      messages: { content: string }[];
    };
    expect(pedidoEnviado.model).toBe('claude-opus-5-5');
    expect(pedidoEnviado.output_config.format).toBeDefined();
    expect(pedidoEnviado.system).toContain('{{nome}}');
    expect(pedidoEnviado.messages[0]?.content).toContain('Exigimos React.');
    expect(pedidoEnviado.messages[0]?.content).toContain('TypeScript');
  });

  it.each(['refusal', 'max_tokens'] as const)(
    'stop_reason %s vira falha definitiva',
    async (stopReason) => {
      const provedor = provedorCom(
        vi.fn().mockResolvedValue(respostaDeCarta({ stop_reason: stopReason })),
      );

      await expect(provedor.writeCoverLetter(pedido)).rejects.toMatchObject({ code: stopReason });
    },
  );

  it.each([{ body: 42 }, { body: '   ' }])('saída %o vira invalid_output', async (saida) => {
    const provedor = provedorCom(vi.fn().mockResolvedValue(resposta({ parsed_output: saida })));

    await expect(provedor.writeCoverLetter(pedido)).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });

  it('pedido recusado pela API (400) não é repetido; 429 sobe como está', async () => {
    const recusa = new Anthropic.BadRequestError(400, undefined, 'inválido', new Headers());
    const limite = new Anthropic.RateLimitError(429, undefined, 'devagar', new Headers());

    await expect(
      provedorCom(vi.fn().mockRejectedValue(recusa)).writeCoverLetter(pedido),
    ).rejects.toBeInstanceOf(CoverLetterError);
    await expect(
      provedorCom(vi.fn().mockRejectedValue(limite)).writeCoverLetter(pedido),
    ).rejects.toBe(limite);
  });
});
