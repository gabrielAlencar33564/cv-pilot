'use client';

import { SearchProfileInput } from '@cv-pilot/contracts';
import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useApiMutation, useSources } from '@/features/shared/queries';
import { seniorityLabels, toOptions, workModelLabels } from '@/lib/labels';

const frequencyOptions = [
  { value: '60', label: 'A cada 1 hora' },
  { value: '360', label: 'A cada 6 horas' },
  { value: '720', label: 'A cada 12 horas' },
  { value: '1440', label: 'Uma vez por dia' },
];

export function SearchProfileForm({ onDone }: { onDone: () => void }) {
  const { data: sources = [] } = useSources();
  const create = useApiMutation<SearchProfileInput>({
    path: '/search-profiles',
    invalidate: ['search-profiles'],
    success: 'Perfil de busca criado',
  });

  const form = useForm<SearchProfileInput>({
    initialValues: {
      name: '',
      keywords: [],
      excludeKeywords: [],
      seniorities: [],
      workModels: [],
      location: '',
      sourceIds: [],
      frequencyMinutes: 360,
      dailyApplyLimit: 10,
      minScoreAutoApply: 75,
    },
    // valida com o mesmo schema Zod usado pela API
    validate: (values) => {
      const result = SearchProfileInput.safeParse(values);
      if (result.success) return {};
      return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => create.mutate(values, { onSuccess: onDone }))}>
      <Stack>
        <TextInput label="Nome do perfil" placeholder="Dev Front-end Pleno Remoto" {...form.getInputProps('name')} />
        <TagsInput
          label="Cargos / palavras-chave"
          description="Pressione Enter para adicionar"
          placeholder="react, front-end"
          {...form.getInputProps('keywords')}
        />
        <TagsInput label="Excluir vagas que contenham" placeholder="estágio, PHP" {...form.getInputProps('excludeKeywords')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <MultiSelect label="Senioridade" data={toOptions(seniorityLabels)} {...form.getInputProps('seniorities')} />
          <MultiSelect label="Modelo de trabalho" data={toOptions(workModelLabels)} {...form.getInputProps('workModels')} />
        </SimpleGrid>
        <TextInput label="Localização" placeholder="São Paulo - SP" {...form.getInputProps('location')} />
        <MultiSelect
          label="Buscar nos sites"
          data={sources.map((s) => ({ value: s.id, label: s.displayName }))}
          {...form.getInputProps('sourceIds')}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select
            label="Frequência"
            data={frequencyOptions}
            value={String(form.values.frequencyMinutes)}
            onChange={(v) => form.setFieldValue('frequencyMinutes', Number(v ?? 360))}
          />
          <NumberInput label="Candidaturas por dia" min={0} max={100} {...form.getInputProps('dailyApplyLimit')} />
          <NumberInput
            label="Nota mínima p/ envio"
            min={0}
            max={100}
            suffix="%"
            {...form.getInputProps('minScoreAutoApply')}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button type="submit" loading={create.isPending}>
            Salvar perfil
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
