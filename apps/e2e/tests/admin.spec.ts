import type { Locator } from '@playwright/test';
import { db, seedAdminScenario } from '../support/db';
import { expect, test } from '../support/fixtures';

/** O input do Switch do Mantine fica escondido; quem o usuário clica é o trilho, um label dele. */
async function clicarNoSwitch(sw: Locator) {
  const id = await sw.getAttribute('id');
  await sw.page().locator(`label[for="${id}"]`).click();
}

test.describe('admin (RF-35, RF-80, RF-81)', () => {
  // a conta da fixture é de candidato: sem o papel ADMIN
  test('quem não é admin não vê o menu nem o painel', async ({ page, account: _candidato }) => {
    await page.goto('/admin');

    await expect(page.getByText('Esta área é só para administradores.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('vê a saúde da fonte, as execuções, desliga a fonte e inclui uma empresa no catálogo', async ({
    page,
    account,
  }) => {
    const source = await seedAdminScenario(account.id);
    await page.goto('/');

    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    const linha = page.getByRole('row', { name: /ATS de teste do admin/ });
    // 1 de 2 execuções com erro: metade ou mais com problema é "Falhando"
    await expect(linha.getByText('Falhando')).toBeVisible();
    await expect(linha.getByText('2 (1 com problema)')).toBeVisible();

    await linha.getByRole('button', { name: 'Execuções de ATS de teste do admin' }).click();
    const execucoes = page.getByRole('dialog', { name: 'Execuções: ATS de teste do admin' });
    await expect(execucoes.getByText('HTTP 503 em https://ats.test')).toBeVisible();
    await expect(
      execucoes.getByText('12 lidas · 3 novas ou alteradas · 0 encerradas'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(execucoes).toBeHidden();

    await clicarNoSwitch(linha.getByRole('switch', { name: 'Desligar ATS de teste do admin' }));
    const confirmar = page.getByRole('dialog', { name: 'Desligar fonte' });
    await confirmar.getByRole('button', { name: 'Desligar' }).click();
    await expect(confirmar).toBeHidden();
    await expect(linha.getByText('Pausada')).toBeVisible();
    expect((await db.source.findUniqueOrThrow({ where: { id: source.id } })).active).toBe(false);

    await page.getByRole('tab', { name: 'Catálogo de empresas' }).click();
    await page.getByRole('textbox', { name: 'Fonte' }).click();
    await page.getByRole('option', { name: 'ATS de teste do admin' }).click();
    await page.getByLabel('Empresa (slug no site)').fill('Empresa-Teste');
    await page.getByRole('button', { name: 'Incluir empresa' }).click();
    await expect(page.getByRole('cell', { name: 'empresa-teste', exact: true })).toBeVisible();
    expect(
      await db.careerBoard.count({ where: { sourceId: source.id, token: 'empresa-teste' } }),
    ).toBe(1);

    // o Bull Board abre noutra aba, na API, com a mesma sessão, e carrega sob a CSP do helmet
    const [filas] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('link', { name: 'Filas (Bull Board)' }).click(),
    ]);
    await expect(filas.getByText('ingest', { exact: true }).first()).toBeVisible();
  });
});
