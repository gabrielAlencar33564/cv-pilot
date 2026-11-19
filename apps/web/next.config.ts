import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // imagem Docker enxuta: copia só o necessário para rodar
  output: 'standalone',
  // o E2E faz o próprio build (porta 3100, outra API) sem brigar com o `pnpm dev` em `.next`
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@cv-pilot/contracts'],
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
  },
};

export default config;
