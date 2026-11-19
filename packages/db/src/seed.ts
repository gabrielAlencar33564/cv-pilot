import { prisma } from './index';

/** Fontes iniciais. Cada id corresponde a um adapter em @cv-pilot/adapters. */
const sources = [
  { id: 'gupy', displayName: 'Gupy', kind: 'api', applyModes: ['assisted'] },
  { id: 'greenhouse', displayName: 'Greenhouse', kind: 'api', applyModes: ['api', 'assisted'] },
  { id: 'lever', displayName: 'Lever', kind: 'api', applyModes: ['api', 'assisted'] },
  {
    id: 'linkedin',
    displayName: 'LinkedIn',
    kind: 'browser',
    applyModes: ['assisted'],
    active: false,
  },
];

/**
 * Empresas de exemplo para o Greenhouse e o Lever terem o que baixar em dev. São os mesmos
 * boards públicos das fixtures dos adapters. Em produção, o catálogo cresce pelo admin.
 */
const devCareerBoards = [
  { sourceId: 'greenhouse', token: 'gitlab' },
  { sourceId: 'lever', token: 'leverdemo' },
];

async function main() {
  for (const s of sources) {
    await prisma.source.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // Usuário de desenvolvimento (somente para ambiente local)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.user.upsert({
      where: { email: 'dev@cvpilot.local' },
      // admin em dev, para o painel /admin ficar acessível sem SQL à mão
      update: { role: 'ADMIN' },
      create: { id: 'dev-user', email: 'dev@cvpilot.local', name: 'Usuário Dev', role: 'ADMIN' },
    });
    for (const board of devCareerBoards) {
      await prisma.careerBoard.upsert({
        where: { sourceId_token: board },
        update: {},
        create: board,
      });
    }
  }
  console.log(`Seed concluído: ${sources.length} fontes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
