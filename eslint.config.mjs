// @ts-check
// Configuração única de lint do monorepo. Regras e motivos: AGENTS.md → "Regras de código".
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const APPS = ['@cv-pilot/api', '@cv-pilot/web', '@cv-pilot/workers'];

/**
 * Limites entre pacotes (AGENTS.md → "Mapa do repositório").
 * Recebe os pacotes internos que a camada NÃO pode importar.
 * @param {string[]} proibidos
 */
const limites = (proibidos) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: proibidos,
          message: 'Import fora dos limites entre pacotes (AGENTS.md → Mapa do repositório).',
        },
      ],
    },
  ],
});

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/.next/',
    '**/.turbo/',
    '**/coverage/',
    '.codegraph/',
    'packages/db/src/generated/',
    'apps/web/next-env.d.ts',
  ]),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Código morto: tolerância zero
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name=/^(only|skip)$/]',
          message: 'Não deixe .only/.skip no código (AGENTS.md → Testes).',
        },
      ],

      // Qualidade
      eqeqeq: ['error', 'smart'],

      // Handlers do Fastify e contratos dos adapters exigem funções async mesmo sem await.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Arquivos JS de configuração não fazem parte de nenhum tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Frontend
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { '@next/next': nextPlugin },
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...limites([
        '@cv-pilot/core',
        '@cv-pilot/db',
        '@cv-pilot/queue',
        '@cv-pilot/adapters',
        '@cv-pilot/ai',
        ...APPS,
      ]),
    },
  },

  // Limites das demais camadas
  {
    files: ['apps/api/**/*.ts'],
    rules: limites(['@cv-pilot/adapters', '@cv-pilot/ai', ...APPS]),
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: limites([
      '@cv-pilot/db',
      '@cv-pilot/queue',
      '@cv-pilot/adapters',
      '@cv-pilot/ai',
      ...APPS,
    ]),
  },
  {
    files: ['packages/adapters/**/*.ts', 'packages/ai/**/*.ts'],
    rules: limites(['@cv-pilot/core', '@cv-pilot/db', '@cv-pilot/queue', ...APPS]),
  },
  {
    files: ['packages/contracts/**/*.ts', 'packages/db/**/*.ts', 'packages/queue/**/*.ts'],
    rules: limites(['@cv-pilot/*']),
  },

  // Script de linha de comando: a saída no terminal é o objetivo.
  {
    files: ['packages/db/src/seed.ts'],
    rules: { 'no-console': 'off' },
  },
);
