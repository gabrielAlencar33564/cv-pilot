import { randomUUID } from 'node:crypto';
import { TERMS_VERSION } from '@cv-pilot/contracts';
import { test as base, expect, type Page } from '@playwright/test';
import { db, E2E_EMAIL_DOMAIN } from './db';
import { API_URL, WEB_URL } from './urls';

/** Senha das contas do E2E (só existem no banco de teste). */
export const E2E_PASSWORD = 'senha-e2e-1234';

export interface Account {
  id: string;
  name: string;
  email: string;
}

export const newEmail = () => `e2e-${randomUUID()}${E2E_EMAIL_DOMAIN}`;

// o login confere a origem: as chamadas diretas à API se apresentam como o web do E2E
const fromWeb = { origin: WEB_URL };

/**
 * Cadastra pela API, como a tela de cadastro faz. O cookie da sessão fica no contexto da
 * página (`page.request` divide os cookies com o navegador), então a página já entra logada.
 */
export async function signUp(
  page: Page,
  { acceptTerms = true }: { acceptTerms?: boolean } = {},
): Promise<Account> {
  const name = 'Pessoa E2E';
  const email = newEmail();
  const res = await page.request.post(`${API_URL}/auth/sign-up/email`, {
    headers: fromWeb,
    data: { name, email, password: E2E_PASSWORD },
  });
  expect(res.ok(), await res.text()).toBe(true);
  if (acceptTerms) {
    const consent = await page.request.post(`${API_URL}/me/consents`, {
      headers: fromWeb,
      data: { termsVersion: TERMS_VERSION },
    });
    expect(consent.status()).toBe(201);
  }
  const { id } = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return { id, name, email };
}

/**
 * Exclui a conta pela API, que apaga também os arquivos no S3. Se a sessão já acabou (o teste
 * saiu ou excluiu a conta), apaga direto no banco o que ainda existir.
 */
export async function removeAccount(page: Page, email: string) {
  const res = await page.request.post(`${API_URL}/auth/delete-user`, {
    headers: fromWeb,
    data: { password: E2E_PASSWORD },
  });
  if (!res.ok()) await db.user.deleteMany({ where: { email } });
}

/**
 * Espera a página assentar depois de um redirecionamento do próprio app (`location.assign`
 * ao sair, ao pedir o aceite). A URL muda antes de o React hidratar, e o que for digitado ou
 * marcado antes disso some quando ele assume os campos. `goto` e `reload` já esperam sozinhos.
 */
export async function waitForRedirectedPage(page: Page, url: RegExp) {
  await expect(page).toHaveURL(url);
  await page.waitForLoadState('networkidle');
}

/** `account`: uma conta nova, logada e com os termos aceitos, excluída ao fim do teste. */
export const test = base.extend<{ account: Account }>({
  account: async ({ page }, use) => {
    const account = await signUp(page);
    await use(account);
    await removeAccount(page, account.email);
  },
});

export { expect };
