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
import { numberOrNull, textOrNull } from '@/lib/form-values';
import { contractTypeLabels, seniorityLabels, toOptions, workModelLabels } from '@/lib/labels';
import type { SearchProfileRow } from '@/lib/types';

const frequencyOptions = [
  { value: '60', label: 'A cada 1 hora' },
  { value: '360', label: 'A cada 6 horas' },
  { value: '720', label: 'A cada 12 horas' },
  { value: '1440', label: 'Uma vez por dia' },
];

type ProfileValues = Omit<SearchProfileInput, 'location' | 'salaryMin' | 'salaryMax'> & {
  location: string;
  salaryMin: number | '';
  salaryMax: number | '';
};

const EMPTY_PROFILE: ProfileValues = {
  name: '',
  keywords: [],
  excludeKeywords: [],
  seniorities: [],
  workModels: [],
  contractTypes: [],
  location: '',
  salaryMin: '',
  salaryMax: '',
  companyBlacklist: [],
  sourceIds: [],
  frequencyMinutes: 360,
  dailyApplyLimit: 10,
  minScoreAutoApply: 75,
  active: true,
};

function toValues(p: Omit<SearchProfileRow, 'id'>): ProfileValues {
  return {
    name: p.name,
    keywords: p.keywords,
    excludeKeywords: p.excludeKeywords,
    seniorities: p.seniorities,
    workModels: p.workModels,
    contractTypes: p.contractTypes,
    location: p.location ?? '',
    salaryMin: p.salaryMin ?? '',
    salaryMax: p.salaryMax ?? '',
    companyBlacklist: p.companyBlacklist,
    sourceIds: p.sourceIds,
    frequencyMinutes: p.frequencyMinutes,
    dailyApplyLimit: p.dailyApplyLimit,
    minScoreAutoApply: p.minScoreAutoApply,
    active: p.active,
  };
}

const toInput = (v: ProfileValues): SearchProfileInput => ({
  ...v,
  location: textOrNull(v.location),
  salaryMin: numberOrNull(v.salaryMin),
  salaryMax: numberOrNull(v.salaryMax),
});

/**
 * Cria, edita (com `profileId`) ou duplica (só `initial`) um perfil de busca (RF-11, RF-12).
 */
export function SearchProfileForm({
  initial,
  profileId,
  onDone,
}: {
  initial?: Omit<SearchProfileRow, 'id'>;
  profileId?: string;
  onDone: () => void;
}) {
  const { data: sources = [] } = useSources();
  const save = useApiMutation<SearchProfileInput>({
    path: profileId ? `/search-profiles/${profileId}` : '/search-profiles',
    method: profileId ? 'PUT' : 'POST',
    invalidate: ['search-profiles'],
    success: profileId ? 'Perfil de busca salvo' : 'Perfil de busca criado',
  });

  const form = useForm<ProfileValues>({
    initialValues: initial ? toValues(initial) : EMPTY_PROFILE,
    // valida com o mesmo schema Zod usado pela API
    validate: (values) => {
      const result = SearchProfileInput.safeParse(toInput(values));
      if (result.success) return {};
      return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(toInput(values), { onSuccess: onDone }))}>
      <Stack>
        <TextInput
          label="Nome do perfil"
          placeholder="Dev Front-end Pleno Remoto"
          {...form.getInputProps('name')}
        />
        <TagsInput
          label="Cargos / palavras-chave"
          description="Pressione Enter para adicionar"
          placeholder="react, front-end"
          {...form.getInputProps('keywords')}
        />
        <TagsInput
          label="Excluir vagas que contenham"
          placeholder="estágio, PHP"
          {...form.getInputProps('excludeKeywords')}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <MultiSelect
            label="Senioridade"
            data={toOptions(seniorityLabels)}
            {...form.getInputProps('seniorities')}
          />
          <MultiSelect
            label="Modelo de trabalho"
            data={toOptions(workModelLabels)}
            {...form.getInputProps('workModels')}
          />
          <MultiSelect
            label="Tipo de contrato"
            data={toOptions(contractTypeLabels)}
            {...form.getInputProps('contractTypes')}
          />
        </SimpleGrid>
        <TextInput
          label="Localização"
          placeholder="São Paulo - SP"
          {...form.getInputProps('location')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Salário mínimo (mensal)"
            description="Vagas que pagam menos ficam de fora"
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            min={0}
            allowDecimal={false}
            {...form.getInputProps('salaryMin')}
          />
          <NumberInput
            label="Salário máximo (mensal)"
            description="Opcional"
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            min={0}
            allowDecimal={false}
            {...form.getInputProps('salaryMax')}
          />
        </SimpleGrid>
        <TagsInput
          label="Empresas excluídas"
          description="Vagas dessas empresas não aparecem neste perfil"
          placeholder="Nome da empresa"
          {...form.getInputProps('companyBlacklist')}
        />
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
          <NumberInput
            label="Candidaturas por dia"
            min={0}
            max={100}
            {...form.getInputProps('dailyApplyLimit')}
          />
          <NumberInput
            label="Nota mínima p/ envio"
            min={0}
            max={100}
            suffix="%"
            {...form.getInputProps('minScoreAutoApply')}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Salvar perfil
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
