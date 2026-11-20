import { E2E_SOURCE, seedSentApplications, simulateWeekAfterFollowUp } from '../support/db';
import { expect, test } from '../support/fixtures';

test('follow-up da candidatura parada e métricas por currículo e site (RF-63)', async ({
  page,
  account,
}) => {
  const { parada, entrevista } = await seedSentApplications(account.id);

  // enviada há 8 dias sem resposta: o card pede follow-up, com a mensagem pronta
  await page.goto('/applications');
  await expect(page.getByText('Fazer follow-up')).toHaveCount(1);
  await page.getByRole('button', { name: `Follow-up de ${parada.title}` }).click();
  const followUp = page.getByRole('dialog', { name: 'Follow-up' });
  const mensagem = followUp.getByLabel('Mensagem');
  await expect(mensagem).toHaveValue(new RegExp(`vaga de ${parada.title} na ${parada.company}`));
  await expect(mensagem).toHaveValue(new RegExp(`${account.name}$`));
  await followUp.getByRole('button', { name: 'Já mandei' }).click();
  await expect(followUp).toBeHidden();
  await expect(page.getByText('Fazer follow-up')).toHaveCount(0);
  // a candidatura que chegou à entrevista nunca pediu follow-up
  await expect(page.getByRole('button', { name: `Follow-up de ${entrevista.title}` })).toHaveCount(
    0,
  );

  // uma semana depois do follow-up, ainda sem resposta: o painel sugere "Sem resposta"
  await simulateWeekAfterFollowUp(account.id);
  await page.reload();
  await expect(page.getByText('Sem resposta uma semana depois do follow-up.')).toBeVisible();
  await page.getByRole('button', { name: `Mover ${parada.title} para Sem resposta` }).click();
  await expect(page.getByText('Encerradas (1)')).toBeVisible();

  // métricas: 2 enviadas, 1 com resposta (a entrevista); a sem resposta conta só como enviada
  await page.getByRole('link', { name: 'Métricas' }).click();
  await expect(page.getByRole('heading', { name: 'Métricas' })).toBeVisible();
  await expect(page.getByText('1 de 2').first()).toBeVisible();
  const porSite = page.getByRole('table').nth(1);
  await expect(
    porSite.getByRole('row', { name: new RegExp(E2E_SOURCE.displayName) }),
  ).toContainText('50% (1)');
  const cruzada = page.getByRole('table').nth(2);
  await expect(cruzada.getByRole('row', { name: /CV Humanizado/ })).toContainText(
    E2E_SOURCE.displayName,
  );
});

test('métricas sem nenhuma candidatura enviada', async ({ page, account: _candidato }) => {
  await page.goto('/metricas');
  await expect(
    page.getByText('Nenhuma candidatura enviada ainda.', { exact: false }),
  ).toBeVisible();
});
