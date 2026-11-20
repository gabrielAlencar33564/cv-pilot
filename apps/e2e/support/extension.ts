import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext } from '@playwright/test';
import { API_URL } from './urls';

/** Cópia da extensão gerada para o E2E, apontando para a API de teste (porta 4100). */
const EXTENSION_DIR = fileURLToPath(new URL('../dist/extension', import.meta.url));

/** Empacota a extensão com o endereço da API do E2E. Roda uma vez, no global-setup. */
export function buildExtension() {
  execFileSync('pnpm', ['--filter', '@cv-pilot/extension', 'build'], {
    env: { ...process.env, CV_PILOT_API_URL: API_URL, CV_PILOT_EXTENSION_OUT: EXTENSION_DIR },
    stdio: 'inherit',
    // no Windows, o pnpm é um .cmd e só roda por um shell
    shell: process.platform === 'win32',
  });
}

/**
 * Um Chromium com a extensão instalada, num perfil descartável. Extensões precisam do
 * Chromium completo (`channel: 'chromium'`), que também roda sem janela.
 */
export async function launchWithExtension() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'cvpilot-extensao-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    locale: 'pt-BR',
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;

  const close = async (ctx: BrowserContext) => {
    await ctx.close();
    await rm(userDataDir, { recursive: true, force: true });
  };
  return { context, extensionId, close: () => close(context) };
}
