import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // imagem Docker enxuta: copia só o necessário para rodar
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@cv-pilot/contracts'],
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
  },
};

export default config;
