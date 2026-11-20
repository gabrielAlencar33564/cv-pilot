import { db, E2E_SOURCE, simulateResumeParsed } from '../support/db';
import {
  E2E_PASSWORD,
  RESUME_PDF,
  expect,
  newEmail,
  removeAccount,
  test,
} from '../support/fixtures';

test('cadastro com aceite dos termos e onboarding do currículo aos perfis', async ({ page }) => {
  const email = newEmail();
  await page.goto('/cadastro');
  await page.getByLabel('Nome', { exact: true }).fill('Pessoa E2E');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();

  try {
    await expect(page.getByRole('heading', { name: 'Vamos começar' })).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await db.consentLog.count({ where: { userId: user.id } })).toBe(1);

    // passo 1: o arquivo sobe e fica esperando a leitura (o resume-parse é simulado)
    // a leitura pela IA é simulada
    await page.locator('input[type="file"]').setInputFiles(RESUME_PDF);
    await expect(page.getByText(/Lendo seu currículo/)).toBeVisible();
    await simulateResumeParsed(user.id);
    await expect(page.getByText(/Currículo lido/)).toBeVisible();
    await page.getByRole('button', { name: 'Ver perfis sugeridos' }).click();

    // passo 2: o perfil sugerido vem do cargo e das habilidades do currículo
    await expect(page.getByLabel('Nome do perfil')).toHaveValue('Desenvolvedora Front-end Pleno');
    await page.getByRole('button', { name: 'Escolher os sites' }).click();

    // passo 3: sem site escolhido, não cria nada
    await page.getByRole('button', { name: 'Criar perfis' }).click();
    await expect(page.getByText('Escolha ao menos um site')).toBeVisible();
    // o rótulo nomeia o campo e a lista de opções: o alvo é o campo
    await page.getByRole('textbox', { name: 'Buscar vagas nestes sites' }).click();
    await page.getByRole('option', { name: E2E_SOURCE.displayName }).click();
    await page.getByRole('button', { name: 'Criar perfis' }).click();

    await expect(page.getByRole('heading', { name: 'Bem-vindo ao CV Pilot' })).toBeVisible();
    expect(await db.searchProfile.findMany({ where: { userId: user.id } })).toEqual([
      expect.objectContaining({
        name: 'Desenvolvedora Front-end Pleno',
        keywords: ['Desenvolvedora Front-end', 'React', 'TypeScript', 'Node.js'],
        seniorities: ['mid'],
        sourceIds: [E2E_SOURCE.id],
      }),
    ]);
    // e a regra de envio padrão com o currículo enviado
    expect(
      await db.sendRule.count({
        where: { userId: user.id, sourceId: null, searchProfileId: null },
      }),
    ).toBe(1);
  } finally {
    // pela API: apaga também o arquivo enviado ao S3
    await removeAccount(page, email);
  }
});
