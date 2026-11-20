import { simulateCompanyDetected } from '../support/db';
import { expect, test } from '../support/fixtures';

test('adicionar empresa: cola a página de carreiras e acompanha a análise', async ({
  page,
  account,
}) => {
  await page.goto('/empresas');
  await expect(page.getByText('Nenhuma empresa sugerida ainda.', { exact: false })).toBeVisible();

  const campo = page.getByLabel('Página de carreiras da empresa');
  await campo.fill('ftp://empresa.test/carreiras');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('use um endereço http ou https')).toBeVisible();

  await campo.fill('https://empresa-e2e.test/carreiras');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Empresa enviada para análise')).toBeVisible();
  await expect(page.getByText('https://empresa-e2e.test/carreiras')).toBeVisible();
  await expect(page.getByText('Analisando')).toBeVisible();

  // o detector roda no worker, que não sobe no E2E: o resultado é simulado no banco
  const board = await simulateCompanyDetected(account.id);
  // a lista se atualiza sozinha enquanto há sugestão pendente
  await expect(page.getByText('No catálogo')).toBeVisible();
  await expect(
    page.getByText(`Entrou no catálogo do Site de teste E2E (${board.token}).`, { exact: false }),
  ).toBeVisible();
});
