import { greenhouseAdapter } from './greenhouse';
import { gupyAdapter } from './gupy';
import { leverAdapter } from './lever';
import type { JobSourceAdapter } from './types';

/**
 * Registro de adapters. Para adicionar um site:
 * 1. crie src/<site>/index.ts implementando JobSourceAdapter
 * 2. adicione aqui
 * 3. cadastre a fonte (tabela Source) via seed ou admin
 */
const adapters: JobSourceAdapter<unknown>[] = [gupyAdapter, greenhouseAdapter, leverAdapter];

const byId = new Map(adapters.map((a) => [a.id, a]));

export function getAdapter(id: string): JobSourceAdapter<unknown> {
  const adapter = byId.get(id);
  if (!adapter) throw new Error(`Adapter não registrado: ${id}`);
  return adapter;
}
