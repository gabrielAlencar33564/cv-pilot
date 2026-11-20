// Empacota a extensão (Manifest V3) em `dist/` ou em CV_PILOT_EXTENSION_OUT.
// O endereço da API é fixado no build (CV_PILOT_API_URL), como o NEXT_PUBLIC_API_URL do web:
// a permissão de acesso ao host da API precisa estar no manifesto.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = import.meta.dirname;
const apiUrl = process.env.CV_PILOT_API_URL ?? 'http://localhost:4000';
// relativo a este pacote, ou absoluto (o E2E gera a própria cópia, apontando para a API de teste)
const outdir = resolve(root, process.env.CV_PILOT_EXTENSION_OUT ?? 'dist');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ['popup', 'background', 'fill'].map((name) => join(root, 'src', `${name}.ts`)),
  outdir,
  bundle: true,
  // o fill.js é injetado com chrome.scripting.executeScript, que não aceita módulo ES
  format: 'iife',
  target: 'chrome120',
  define: { CV_PILOT_API_URL: JSON.stringify(apiUrl.replace(/\/$/, '')) },
  legalComments: 'none',
});

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'static', 'manifest.json'), 'utf8'));
await writeFile(
  join(outdir, 'manifest.json'),
  JSON.stringify(
    {
      ...manifest,
      version: pkg.version,
      // a API e as páginas de vaga (https) onde o candidato pede o preenchimento
      host_permissions: [`${new URL(apiUrl).origin}/*`, 'https://*/*'],
    },
    null,
    2,
  ),
);
await cp(join(root, 'static', 'popup.html'), join(outdir, 'popup.html'));
await cp(join(root, 'static', 'popup.css'), join(outdir, 'popup.css'));
