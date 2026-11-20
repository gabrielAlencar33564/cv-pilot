'use client';

import { CreateCompanySuggestionInput, type CompanySuggestionRow } from '@cv-pilot/contracts';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSources } from '@/features/shared/queries';
import { api } from '@/lib/api';
import { companySuggestionStatusLabels } from '@/lib/labels';

const QUERY_KEY = 'company-suggestions';
/** Enquanto alguma sugestão está na fila, a lista se atualiza sozinha. */
const PENDING_REFRESH_MS = 3000;

const SUGGEST_ERRORS: Record<string, string> = {
  suggestion_limit_reached: 'Você já sugeriu 20 empresas nas últimas 24 horas. Tente amanhã.',
  validation_error: 'Confira o endereço: ele precisa começar com https://.',
};

/** O que aconteceu com cada sugestão, em uma frase. */
function outcomeText(s: CompanySuggestionRow, sourceName: string) {
  switch (s.status) {
    case 'pending':
      return 'Procurando o site de vagas da empresa nesta página.';
    case 'added':
      return `Entrou no catálogo do ${sourceName}${s.boardToken ? ` (${s.boardToken})` : ''}. As vagas aparecem nos perfis que buscam no ${sourceName}.`;
    case 'covered':
      return `Esta empresa já é coberta pela busca no ${sourceName}.`;
    case 'not_detected':
      // páginas montadas por JavaScript não trazem o link do ATS no HTML; o link de uma vaga traz
      return 'Não achamos nesta página um site de vagas que o CV Pilot lê (Greenhouse, Lever, TOTVS, Gupy ou Solides). Tente colar o link de uma vaga da empresa.';
    case 'unreachable':
      return 'Não foi possível ler a página: o site não permite o acesso do bot ou não respondeu.';
  }
}

function SuggestForm() {
  const qc = useQueryClient();
  const form = useForm<CreateCompanySuggestionInput>({
    initialValues: { url: '' },
    validate: (values) => {
      const parsed = CreateCompanySuggestionInput.safeParse(values);
      return parsed.success ? {} : { url: parsed.error.issues[0]?.message };
    },
  });
  const suggest = useMutation({
    mutationFn: (body: CreateCompanySuggestionInput) =>
      api<CompanySuggestionRow>('/company-suggestions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      form.reset();
      void qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      notifications.show({ color: 'green', message: 'Empresa enviada para análise' });
    },
  });
  const error = suggest.error && (SUGGEST_ERRORS[suggest.error.message] ?? suggest.error.message);

  return (
    <form onSubmit={form.onSubmit((values) => suggest.mutate(values))}>
      <Stack gap="xs">
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            label="Página de carreiras da empresa"
            placeholder="https://empresa.com.br/carreiras"
            style={{ flex: 1 }}
            key={form.key('url')}
            {...form.getInputProps('url')}
          />
          <Button type="submit" leftSection={<IconPlus size={16} />} loading={suggest.isPending}>
            Adicionar
          </Button>
        </Group>
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
      </Stack>
    </form>
  );
}

/** "Adicionar empresa": o candidato cola a página de carreiras e o detector faz o resto. */
export function CompanySuggestions() {
  const { data: sources = [] } = useSources();
  const {
    data: suggestions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => api<CompanySuggestionRow[]>('/company-suggestions'),
    refetchInterval: (query) =>
      query.state.data?.some((s) => s.status === 'pending') ? PENDING_REFRESH_MS : false,
  });
  const sourceName = (id: string | null) =>
    sources.find((s) => s.id === id)?.displayName ?? id ?? '';

  return (
    <Stack>
      <SuggestForm />
      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar as empresas sugeridas.</Text>}
      {!isLoading && !error && suggestions.length === 0 && (
        <Text c="dimmed">
          Nenhuma empresa sugerida ainda. Cole a página de carreiras de uma empresa que você quer
          acompanhar.
        </Text>
      )}
      {suggestions.map((s) => {
        const status = companySuggestionStatusLabels[s.status];
        return (
          <Card key={s.id} withBorder>
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600} truncate>
                  {s.url}
                </Text>
                <Badge color={status.color} variant="light" style={{ flexShrink: 0 }}>
                  {status.label}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {outcomeText(s, sourceName(s.sourceId))}
              </Text>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
