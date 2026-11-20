import {
  seedJobScenario,
  simulateAssistedApply,
  simulateCoverLetterWritten,
  simulateJobRequirements,
} from '../support/db';
import { expect, test } from '../support/fixtures';

test('da vaga ao kanban: pré-visualiza, candidata, move, anota e recebe o alerta', async ({
  page,
  account,
}) => {
  const { job } = await seedJobScenario(account.id);
  const letter = `Olá, ${job.company}! Sou ${account.name} e quero ser ${job.title}.`;

  // RF-24: a pré-visualização mostra a carta do modelo da regra, já preenchida
  await page.goto('/jobs');
  await page.getByRole('button', { name: `Ver detalhes da vaga ${job.title}` }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalhes da vaga' });
  await expect(drawer.getByText(letter)).toBeVisible();
  await drawer.getByRole('button', { name: 'Candidatar' }).click();
  await expect(page.getByText('Candidatura na fila de envio')).toBeVisible();

  await page.goto('/applications');
  await expect(page.getByText('Na fila (1)')).toBeVisible();
  // na fila não há mudança manual: entrar e sair da fila é com o bot
  await expect(page.getByRole('button', { name: `Mudar o status de ${job.title}` })).toHaveCount(0);

  // o apply (modo assistido) e o notify são simulados: a candidatura passa a pedir ação
  await simulateAssistedApply(account.id);
  await page.reload();
  await expect(page.getByText('Ação necessária (1)')).toBeVisible();
  await expect(page.getByLabel('1 alertas não lidos')).toBeVisible();

  // RF-62: o candidato concluiu no site e marca como enviada
  await page.getByRole('button', { name: `Mudar o status de ${job.title}` }).click();
  await page.getByRole('menuitem', { name: 'Enviada' }).click();
  await expect(page.getByText('Enviada (1)')).toBeVisible();

  await page.getByRole('button', { name: `Anotações de ${job.title}` }).click();
  const notes = page.getByRole('dialog', { name: 'Anotações' });
  await notes.getByLabel('Suas anotações').fill('Entrevista técnica na quinta');
  await notes.getByRole('button', { name: 'Salvar' }).click();
  await expect(notes).toBeHidden();
  await expect(page.getByText('Entrevista técnica na quinta')).toBeVisible();

  await page.getByRole('button', { name: `Carta de ${job.title}` }).click();
  await expect(
    page.getByRole('dialog', { name: 'Carta de apresentação' }).getByText(letter),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // RF-70/71: o alerta aparece com a vaga e sai do contador ao ser lido
  await page.getByRole('link', { name: /Alertas/ }).click();
  await expect(page.getByText('Uma candidatura precisa de você')).toBeVisible();
  await expect(page.getByText(`${job.title} · ${job.company}`)).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como lido' }).click();
  await expect(page.getByLabel('1 alertas não lidos')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marcar tudo como lido' })).toBeDisabled();
});

test('carta pela IA: avisa na vaga, aparece no kanban e o candidato edita antes de enviar (RF-54)', async ({
  page,
  account,
}) => {
  const { job } = await seedJobScenario(account.id, { aiCoverLetter: true });
  const aiLetter = `Prezada equipe da ${job.company},\n\nTrabalho com React e TypeScript.\n\nAtenciosamente,\n${account.name}`;

  await page.goto('/jobs');
  await page.getByRole('button', { name: `Ver detalhes da vaga ${job.title}` }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalhes da vaga' });
  await expect(drawer.getByText(/Ao se candidatar, a IA escreve a carta/)).toBeVisible();
  await drawer.getByRole('button', { name: 'Candidatar' }).click();
  await expect(page.getByText('Candidatura na fila de envio')).toBeVisible();

  await page.goto('/applications');
  await expect(page.getByText('IA escrevendo a carta')).toBeVisible();

  // o worker da carta é simulado; o kanban se atualiza sozinho enquanto a IA escreve
  await simulateCoverLetterWritten(account.id, aiLetter);
  await expect(page.getByText('Carta escrita pela IA')).toBeVisible();

  await page.getByRole('button', { name: `Carta de ${job.title}` }).click();
  const modal = page.getByRole('dialog', { name: 'Carta de apresentação' });
  await expect(modal.getByText('Trabalho com React e TypeScript.')).toBeVisible();
  await modal.getByRole('button', { name: 'Editar carta' }).click();
  await modal.getByLabel('Texto da carta').fill('Minha carta revisada para a vaga.');
  await modal.getByRole('button', { name: 'Salvar carta' }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('Carta editada por você')).toBeVisible();

  await page.getByRole('button', { name: `Carta de ${job.title}` }).click();
  await expect(modal.getByText('Minha carta revisada para a vaga.')).toBeVisible();
});

test('o detalhe da vaga mostra o que falta no currículo (RF-41)', async ({ page, account }) => {
  const { job } = await seedJobScenario(account.id);
  // o currículo do cenário tem React, TypeScript e Node.js
  await simulateJobRequirements(job.id, [
    { name: 'React', aliases: ['React.js'], required: true },
    { name: 'Docker', aliases: [], required: true },
    { name: 'Inglês', aliases: ['English'], required: false },
  ]);

  await page.goto('/jobs');
  await page.getByRole('button', { name: `Ver detalhes da vaga ${job.title}` }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalhes da vaga' });
  await expect(drawer.getByText('Exigidos que não aparecem no currículo')).toBeVisible();
  await expect(drawer.getByText('Docker', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Diferenciais que não aparecem no currículo')).toBeVisible();
  await expect(drawer.getByText('Inglês', { exact: true })).toBeVisible();
  await expect(drawer.getByText('O currículo já mostra: React.')).toBeVisible();
});
