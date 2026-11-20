import { db, seedPendingApplication } from '../support/db';
import { launchWithExtension } from '../support/extension';
import { RESUME_PDF, expect, test, uploadResume } from '../support/fixtures';
import { API_URL } from '../support/urls';

/** Página de vaga falsa, servida pelo próprio teste: nenhum site de verdade é acessado. */
const JOB_URL = 'https://vagas.e2e.test/vaga-assistida';
const JOB_FORM = `<!doctype html>
<html lang="pt-BR"><body>
<form onsubmit="window.enviado = true; return false;">
  <label for="nome">Nome completo</label><input id="nome" name="nome" required>
  <label for="email">E-mail</label><input id="email" type="email" required>
  <label for="tel">Telefone</label><input id="tel" name="telefone">
  <label for="li">Perfil no LinkedIn</label><input id="li" name="linkedin">
  <label for="pret">Pretensão salarial</label><input id="pret">
  <label for="origem">Como soube da vaga?</label><input id="origem" required>
  <label for="carta">Carta de apresentação</label><textarea id="carta"></textarea>
  <label for="cv">Currículo (PDF)</label><input id="cv" type="file" accept=".pdf">
  <button type="submit">Enviar candidatura</button>
</form>
</body></html>`;

test('extensão: conecta com a chave, abre a vaga, preenche sem enviar e marca como enviada', async ({
  page,
  account,
}) => {
  const linkedin = 'https://www.linkedin.com/in/pessoa-e2e';
  await db.user.update({
    where: { id: account.id },
    data: { phone: '(11) 98888-7777', links: { linkedin } },
  });
  const resumeVersionId = await uploadResume(page);
  const { job, application } = await seedPendingApplication(account.id, {
    resumeVersionId,
    jobUrl: JOB_URL,
  });

  // no site: gera a chave da extensão em Minha conta (aparece uma vez só)
  await page.goto('/conta');
  await page.getByRole('button', { name: 'Conectar um navegador' }).click();
  const connect = page.getByRole('dialog', { name: 'Conectar a extensão' });
  await connect.getByRole('button', { name: 'Gerar chave' }).click();
  const token = (await connect.getByLabel('Chave da extensão').textContent()) ?? '';
  expect(token).toMatch(/^cvp_ext_/);
  await connect.getByRole('button', { name: 'Pronto' }).click();
  await expect(page.getByRole('cell', { name: 'Meu navegador', exact: true })).toBeVisible();

  const browser = await launchWithExtension();
  try {
    await browser.context.route(`${JOB_URL}**`, (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: JOB_FORM }),
    );
    const popup = await browser.context.newPage();
    await popup.goto(`chrome-extension://${browser.extensionId}/popup.html`);

    await popup.getByLabel('Chave da extensão').fill(token);
    await popup.getByRole('button', { name: 'Conectar' }).click();
    await expect(popup.getByRole('heading', { name: job.title })).toBeVisible();

    const [vaga] = await Promise.all([
      browser.context.waitForEvent('page'),
      popup.getByRole('button', { name: `Abrir a vaga ${job.title}` }).click(),
    ]);
    await vaga.waitForLoadState();
    await expect(vaga).toHaveURL(JOB_URL);

    await popup.getByRole('button', { name: `Preencher a vaga ${job.title}` }).click();
    await expect(
      popup.getByText(
        'Preenchi 6 campos e anexei o currículo. Ainda há 1 campo obrigatório vazio. Confira tudo e envie no site.',
      ),
    ).toBeVisible();

    await expect(vaga.getByLabel('Nome completo')).toHaveValue(account.name);
    await expect(vaga.getByLabel('E-mail')).toHaveValue(account.email);
    await expect(vaga.getByLabel('Telefone')).toHaveValue('(11) 98888-7777');
    await expect(vaga.getByLabel('Perfil no LinkedIn')).toHaveValue(linkedin);
    // a resposta padrão da regra de envio vence o perfil
    await expect(vaga.getByLabel('Pretensão salarial')).toHaveValue('9500');
    await expect(vaga.getByLabel('Carta de apresentação')).toHaveValue(
      application.coverLetter ?? '',
    );
    // o que a extensão não sabe fica para o candidato
    await expect(vaga.getByLabel('Como soube da vaga?')).toHaveValue('');
    const anexo = await vaga
      .getByLabel('Currículo (PDF)')
      .evaluate((el: HTMLInputElement) => ({
        name: el.files?.[0]?.name,
        size: el.files?.[0]?.size,
      }));
    expect(anexo).toEqual({ name: RESUME_PDF.name, size: RESUME_PDF.buffer.length });
    // RF-53: quem envia é o candidato; a extensão nunca submete o formulário
    expect(await vaga.evaluate(() => (window as { enviado?: boolean }).enviado)).toBeUndefined();

    await popup.getByRole('button', { name: `Marcar ${job.title} como enviada` }).click();
    await expect(popup.getByText(`"${job.title}" foi para Enviadas no CV Pilot.`)).toBeVisible();
    await expect(popup.getByRole('heading', { name: job.title })).toHaveCount(0);
    const salva = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(salva.status).toBe('sent');
    expect(salva.sentAt).not.toBeNull();
  } finally {
    await browser.close();
  }
});

test('extensão: chave desconectada no site volta para a tela de conectar', async ({
  page,
  account,
}) => {
  const created = await page.request.post(`${API_URL}/extension-tokens`, {
    data: { name: 'Navegador antigo' },
  });
  const { token } = (await created.json()) as { token: string };
  await db.extensionToken.deleteMany({ where: { userId: account.id } });

  const browser = await launchWithExtension();
  try {
    const popup = await browser.context.newPage();
    await popup.goto(`chrome-extension://${browser.extensionId}/popup.html`);
    await popup.getByLabel('Chave da extensão').fill(token);
    await popup.getByRole('button', { name: 'Conectar' }).click();

    await expect(popup.getByText(/Chave inválida ou desconectada/)).toBeVisible();
    await expect(popup.getByLabel('Chave da extensão')).toBeVisible();
  } finally {
    await browser.close();
  }
});
