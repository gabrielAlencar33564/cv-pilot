import { z } from 'zod';
import { SourceHttpError } from '../http';
import type { AdapterContext } from '../types';

/*
 * Cliente MCP mínimo (Streamable HTTP) para o servidor público da Solides: só `initialize` e
 * `tools/call`. Usa o `ctx.http`, então cada requisição passa pelo robots.txt, pelo
 * User-Agent do bot e pelo intervalo por host, como qualquer adapter. Sem SDK: são três
 * mensagens JSON-RPC.
 */

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'cv-pilot', version: '0.1' };

const JsonRpcResponse = z.object({
  result: z
    .object({
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
      isError: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

/** A resposta vem como JSON ou como SSE (`data: {...}`), à escolha do servidor. */
async function readMessage(res: Response): Promise<unknown> {
  const body = await res.text();
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    return JSON.parse(body);
  }
  const data = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('');
  return JSON.parse(data);
}

class McpSession {
  private nextId = 1;

  private constructor(
    private readonly endpoint: string,
    private readonly ctx: AdapterContext,
    private readonly sessionId: string | null,
  ) {}

  private static post(
    endpoint: string,
    ctx: AdapterContext,
    sessionId: string | null,
    message: object,
  ) {
    return ctx.http(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId && { 'mcp-session-id': sessionId }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', ...message }),
    });
  }

  /** Abre a sessão: `initialize` e, em seguida, o aviso `notifications/initialized`. */
  static async open(endpoint: string, ctx: AdapterContext): Promise<McpSession> {
    const res = await McpSession.post(endpoint, ctx, null, {
      id: 0,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    });
    const init = JsonRpcResponse.parse(await readMessage(res));
    if (init.error) throw new Error(`MCP recusou o initialize: ${init.error.message}`);
    const sessionId = res.headers.get('mcp-session-id');
    await McpSession.post(endpoint, ctx, sessionId, { method: 'notifications/initialized' });
    return new McpSession(endpoint, ctx, sessionId);
  }

  /** Chama uma tool e devolve o texto do primeiro bloco de conteúdo. */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const res = await McpSession.post(this.endpoint, this.ctx, this.sessionId, {
      id: this.nextId++,
      method: 'tools/call',
      params: { name, arguments: args },
    });
    const message = JsonRpcResponse.parse(await readMessage(res));
    const text = message.result?.content.find((c) => c.type === 'text')?.text;
    if (message.error || message.result?.isError || text === undefined) {
      throw new Error(
        `MCP: a tool ${name} falhou (${message.error?.message ?? text ?? 'sem conteúdo'})`,
      );
    }
    return text;
  }
}

/**
 * Uma sessão por contexto de execução: a busca e o detalhe das vagas novas, no mesmo job,
 * reaproveitam a sessão em vez de abrir uma por chamada. Sessão expirada (404) é reaberta uma vez.
 */
const sessions = new WeakMap<AdapterContext['http'], Promise<McpSession>>();

export async function callMcpTool(
  endpoint: string,
  ctx: AdapterContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const session = () => {
    let open = sessions.get(ctx.http);
    if (!open) {
      open = McpSession.open(endpoint, ctx);
      // uma abertura que falhou não fica guardada: o próximo pedido tenta de novo
      void open.catch(() => sessions.delete(ctx.http));
      sessions.set(ctx.http, open);
    }
    return open;
  };
  try {
    return await (await session()).callTool(name, args);
  } catch (err) {
    if (!(err instanceof SourceHttpError && err.status === 404)) throw err;
    sessions.delete(ctx.http);
    return (await session()).callTool(name, args);
  }
}
