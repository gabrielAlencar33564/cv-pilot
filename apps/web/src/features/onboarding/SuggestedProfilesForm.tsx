'use client';

import { SearchProfileInput, type ProfileSuggestion } from '@cv-pilot/contracts';
import {
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSources } from '@/features/shared/queries';
import { api } from '@/lib/api';
import { seniorityLabels, toOptions } from '@/lib/labels';

type Draft = ProfileSuggestion & { include: boolean };

type OnboardingValues = {
  profiles: Draft[];
  sourceIds: string[];
  /** cria a regra de envio padrão com este currículo (só aparece para quem não tem regra) */
  defaultRule: boolean;
};

const toBody = (p: Draft, sourceIds: string[]): SearchProfileInput => ({
  name: p.name,
  keywords: p.keywords,
  seniorities: p.seniorities,
  sourceIds,
});

/**
 * Passos 2 e 3: revisar os perfis sugeridos e escolher os sites. No fim, cria os perfis e,
 * para quem ainda não tem, a regra de envio padrão com o currículo enviado.
 */
export function SuggestedProfilesForm({
  resumeId,
  suggestions,
  hasSendRules,
  step,
  onNext,
  onBack,
}: {
  resumeId: string;
  suggestions: ProfileSuggestion[];
  hasSendRules: boolean;
  step: 'review' | 'sites';
  onNext: () => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: sources = [] } = useSources();
  const form = useForm<OnboardingValues>({
    initialValues: {
      profiles: suggestions.map((s) => ({ ...s, include: true })),
      sourceIds: [],
      defaultRule: !hasSendRules,
    },
    validate: {
      profiles: {
        name: (v, values, path) =>
          !isIncluded(values, path) || v.trim().length >= 2 ? null : 'Dê um nome ao perfil',
        keywords: (v, values, path) =>
          !isIncluded(values, path) || v.length ? null : 'Inclua ao menos uma palavra-chave',
      },
    },
  });

  const create = useMutation({
    mutationFn: async ({ profiles, sourceIds, defaultRule }: OnboardingValues) => {
      for (const p of profiles.filter((d) => d.include)) {
        const body = SearchProfileInput.parse(toBody(p, sourceIds));
        await api('/search-profiles', { method: 'POST', body: JSON.stringify(body) });
      }
      if (defaultRule) {
        await api('/send-rules', { method: 'POST', body: JSON.stringify({ resumeId }) });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['search-profiles'] });
      void qc.invalidateQueries({ queryKey: ['send-rules'] });
      notifications.show({
        color: 'green',
        message: 'Pronto! Os bots começam a buscar vagas para você.',
      });
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Erro', message: err.message }),
  });

  const included = form.values.profiles.filter((p) => p.include).length;

  if (step === 'review') {
    return (
      <Stack>
        {suggestions.length === 0 && (
          <Text c="dimmed">
            Não achamos cargos nem habilidades no currículo para sugerir.{' '}
            <Anchor component={Link} href="/search-profiles">
              Crie o perfil à mão
            </Anchor>
            .
          </Text>
        )}
        {form.values.profiles.map((p, index) => (
          <Card key={form.key(`profiles.${index}`)} withBorder>
            <Stack gap="xs">
              <Checkbox
                label="Criar este perfil"
                {...form.getInputProps(`profiles.${index}.include`, { type: 'checkbox' })}
              />
              <TextInput
                label="Nome do perfil"
                disabled={!p.include}
                {...form.getInputProps(`profiles.${index}.name`)}
              />
              <TagsInput
                label="Cargos / palavras-chave"
                description="Vieram do seu currículo. Tire ou acrescente o que quiser."
                disabled={!p.include}
                {...form.getInputProps(`profiles.${index}.keywords`)}
              />
              <MultiSelect
                label="Senioridade"
                description="Vazio = qualquer uma"
                data={toOptions(seniorityLabels)}
                disabled={!p.include}
                {...form.getInputProps(`profiles.${index}.seniorities`)}
              />
            </Stack>
          </Card>
        ))}
        <Group justify="space-between">
          <Button variant="default" onClick={onBack}>
            Voltar
          </Button>
          <Button
            disabled={included === 0}
            onClick={() => {
              if (!form.validate().hasErrors) onNext();
            }}
          >
            Escolher os sites
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        // só no último passo: na revisão, os sites ainda não foram escolhidos
        if (!values.sourceIds.length) {
          form.setFieldError('sourceIds', 'Escolha ao menos um site');
          return;
        }
        create.mutate(values);
      })}
    >
      <Stack>
        <MultiSelect
          label="Buscar vagas nestes sites"
          placeholder="Escolha um ou mais"
          data={sources.map((s) => ({ value: s.id, label: s.displayName }))}
          {...form.getInputProps('sourceIds')}
        />
        {!hasSendRules && (
          <Checkbox
            label="Usar este currículo nas candidaturas de todos os sites"
            description="Cria a regra de envio padrão: modo assistido, com revisão antes de enviar."
            {...form.getInputProps('defaultRule', { type: 'checkbox' })}
          />
        )}
        <Text size="sm" c="dimmed">
          {included === 1
            ? 'Será criado 1 perfil de busca.'
            : `Serão criados ${included} perfis de busca.`}{' '}
          Dá para ajustar tudo depois em &quot;O que estou buscando&quot;.
        </Text>
        <Group justify="space-between">
          <Button variant="default" onClick={onBack}>
            Voltar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Criar perfis
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** A validação de um campo do perfil só vale para os perfis marcados para criar. */
function isIncluded(values: OnboardingValues, path: string) {
  const index = Number(path.split('.')[1]);
  return values.profiles[index]?.include ?? false;
}
