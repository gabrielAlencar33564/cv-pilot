import { db } from '../support/db';
import {
  E2E_PASSWORD,
  expect,
  removeAccount,
  signUp,
  test,
  waitForRedirectedPage,
} from '../support/fixtures';
import { API_URL } from '../support/urls';

test.describe('conta (RF-01 a RF-04)', () => {
  test('sai e entra de novo com e-mail e senha', async ({ page, account }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sair' }).click();
    await waitForRedirectedPage(page, /\/login/);

    await page.getByLabel('E-mail', { exact: true }).fill(account.email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-000');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // pelo texto: o anunciador de rotas do Next também tem role="alert"
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();

    await page.getByLabel('Senha', { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    // sem perfil de busca, a página inicial é o onboarding
    await expect(page.getByRole('heading', { name: 'Vamos começar' })).toBeVisible();
  });

  test('sem o aceite dos termos atuais, pede o aceite antes de liberar o sistema', async ({
    page,
  }) => {
    const account = await signUp(page, { acceptTerms: false });
    try {
      // a API responde 403 consent_required, e o app leva para o aceite
      await page.goto('/jobs');
      await waitForRedirectedPage(page, /\/aceite/);
      const accept = page.getByRole('button', { name: 'Aceitar e continuar' });
      await expect(accept).toBeDisabled();
      await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
      await accept.click();
      await expect(page.getByRole('heading', { name: 'Vamos começar' })).toBeVisible();
      expect(await db.consentLog.count({ where: { userId: account.id } })).toBe(1);
    } finally {
      await removeAccount(page, account.email);
    }
  });

  test('exporta os dados e exclui a conta só com a senha certa', async ({ page, account }) => {
    await page.goto('/conta');

    // o botão baixa um arquivo; o conteúdo é conferido pela mesma rota, com a sessão da página
    const exported = await page.request.get(`${API_URL}/me/export`);
    expect(exported.ok()).toBe(true);
    const body = await exported.text();
    expect(body).toContain(account.email);
    expect(body).not.toContain('"password"');

    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir a conta' });
    await dialog.getByLabel('Confirme com a sua senha').fill('senha-errada-000');
    await dialog.getByRole('button', { name: 'Excluir de vez' }).click();
    await expect(dialog.getByText('Senha incorreta.')).toBeVisible();
    expect(await db.user.count({ where: { id: account.id } })).toBe(1);

    await dialog.getByLabel('Confirme com a sua senha').fill(E2E_PASSWORD);
    await dialog.getByRole('button', { name: 'Excluir de vez' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await db.user.count({ where: { id: account.id } })).toBe(0);
  });
});
