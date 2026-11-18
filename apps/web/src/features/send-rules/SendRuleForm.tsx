'use client';

import type { SendRuleInput } from '@cv-pilot/contracts';
import { Button, Group, Select, SimpleGrid, Stack, Switch } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useApiMutation, useResumes, useSearchProfiles, useSources } from '@/features/shared/queries';
import { modeLabels, toOptions, toneLabels } from '@/lib/labels';

const ALL = '__all__';

export function SendRuleForm({ onDone }: { onDone: () => void }) {
  const { data: sources = [] } = useSources();
  const { data: resumes = [] } = useResumes();
  const { data: profiles = [] } = useSearchProfiles();
  const create = useApiMutation<SendRuleInput>({
    path: '/send-rules',
    invalidate: ['send-rules'],
    success: 'Regra de envio salva',
  });

  const form = useForm({
    initialValues: {
      sourceId: ALL,
      searchProfileId: ALL,
      resumeId: '',
      tone: 'technical',
      mode: 'assisted',
      generateCoverLetter: false,
      reviewBeforeSend: true,
    },
    validate: { resumeId: (v) => (v ? null : 'Escolha um currículo') },
  });

  const submit = form.onSubmit((v) =>
    create.mutate(
      {
        ...v,
        sourceId: v.sourceId === ALL ? null : v.sourceId,
        searchProfileId: v.searchProfileId === ALL ? null : v.searchProfileId,
        tone: v.tone as SendRuleInput['tone'],
        mode: v.mode as SendRuleInput['mode'],
      },
      { onSuccess: onDone },
    ),
  );

  return (
    <form onSubmit={submit}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Site"
            data={[{ value: ALL, label: 'Todos os sites (padrão)' }, ...sources.map((s) => ({ value: s.id, label: s.displayName }))]}
            {...form.getInputProps('sourceId')}
          />
          <Select
            label="Perfil de busca"
            data={[{ value: ALL, label: 'Todos os perfis' }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
            {...form.getInputProps('searchProfileId')}
          />
        </SimpleGrid>
        <Select
          label="Currículo a enviar"
          placeholder="Escolha"
          data={resumes.map((r) => ({ value: r.id, label: r.name }))}
          nothingFoundMessage="Cadastre um currículo primeiro"
          {...form.getInputProps('resumeId')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select label="Tom da carta" data={toOptions(toneLabels)} {...form.getInputProps('tone')} />
          <Select label="Modo de envio" data={toOptions(modeLabels)} {...form.getInputProps('mode')} />
        </SimpleGrid>
        <Switch label="Gerar carta de apresentação com IA" {...form.getInputProps('generateCoverLetter', { type: 'checkbox' })} />
        <Switch label="Revisar antes de enviar" {...form.getInputProps('reviewBeforeSend', { type: 'checkbox' })} />
        <Group justify="flex-end">
          <Button type="submit" loading={create.isPending}>
            Salvar regra
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
