'use client';

import {
  Alert,
  Button,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import {
  CreateCareerBoardInput,
  type AdminSourceRow,
  type CareerBoardRow,
  type Paginated,
} from '@cv-pilot/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiMutation } from '@/features/shared/queries';
import { api } from '@/lib/api';
import { formatDate } from './format';

const BOARDS_PAGE_SIZE = 20;

const CREATE_ERRORS: Record<string, string> = {
  career_board_exists: 'Essa empresa já está no catálogo desta fonte.',
  source_not_found: 'Fonte não encontrada. Atualize a página.',
};

function AddBoardForm({ sourceId }: { sourceId: string }) {
  const qc = useQueryClient();
  const form = useForm({
    initialValues: { token: '' },
    validate: ({ token }) => {
      const result = CreateCareerBoardInput.safeParse({ sourceId, token });
      return result.success ? {} : { token: result.error.issues[0]?.message ?? 'Inválido' };
    },
  });
  const create = useMutation({
    mutationFn: (body: CreateCareerBoardInput) =>
      api('/admin/career-boards', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      form.reset();
      void qc.invalidateQueries({ queryKey: ['admin-sources'] });
      void qc.invalidateQueries({ queryKey: ['admin-career-boards'] });
      notifications.show({ color: 'green', message: 'Empresa incluída no catálogo' });
    },
    onError: (err) =>
      notifications.show({
        color: 'red',
        title: 'Erro',
        message: CREATE_ERRORS[err.message] ?? err.message,
      }),
  });

  return (
    <form onSubmit={form.onSubmit(({ token }) => create.mutate({ sourceId, token }))}>
      <Group align="flex-end">
        <TextInput
          label="Empresa (slug no site)"
          description="O que vem depois de boards.greenhouse.io/ ou jobs.lever.co/"
          placeholder="nubank"
          style={{ flex: 1 }}
          {...form.getInputProps('token')}
        />
        <Button type="submit" leftSection={<IconPlus size={16} />} loading={create.isPending}>
          Incluir empresa
        </Button>
      </Group>
    </form>
  );
}

/**
 * Catálogo de empresas das fontes que buscam por empresa: cada board é baixado uma vez por
 * hora para todos os usuários. Desligar um board quebrado não mexe no resto da fonte.
 */
export function CareerBoardsSection({ sources }: { sources: AdminSourceRow[] }) {
  const [sourceId, setSourceId] = useState<string | null>(sources[0]?.id ?? null);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-career-boards', sourceId, page],
    queryFn: () =>
      api<Paginated<CareerBoardRow>>(
        `/admin/career-boards?sourceId=${encodeURIComponent(sourceId ?? '')}&page=${page}&pageSize=${BOARDS_PAGE_SIZE}`,
      ),
    enabled: sourceId !== null,
  });
  const setActive = useApiMutation<{ id: string; active: boolean }>({
    path: (b) => `/admin/career-boards/${b.id}`,
    method: 'PATCH',
    invalidate: ['admin-career-boards'],
  });

  return (
    <Stack>
      <Select
        label="Fonte"
        description="O catálogo só vale para as fontes que buscam por empresa, como Greenhouse e Lever"
        data={sources.map((s) => ({ value: s.id, label: s.displayName }))}
        value={sourceId}
        onChange={(value) => {
          setSourceId(value);
          setPage(1);
        }}
        allowDeselect={false}
        maw={320}
      />
      {sourceId && <AddBoardForm sourceId={sourceId} />}

      {isLoading && <Loader />}
      {error && <Alert color="red">Não foi possível carregar o catálogo.</Alert>}
      {data && data.items.length === 0 && (
        <Text c="dimmed">
          Nenhuma empresa no catálogo desta fonte. Inclua a primeira para o bot começar a buscar as
          vagas dela.
        </Text>
      )}
      {data && data.items.length > 0 && (
        <Table.ScrollContainer minWidth={640}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Empresa</Table.Th>
                <Table.Th>Vagas abertas</Table.Th>
                <Table.Th>Última leitura</Table.Th>
                <Table.Th>Ativa</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((b) => (
                <Table.Tr key={b.id}>
                  <Table.Td>
                    <Text size="sm">{b.token}</Text>
                    {b.lastError && (
                      <Text size="xs" c="red" lineClamp={2} title={b.lastError}>
                        {b.lastError}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{b.openJobs}</Table.Td>
                  <Table.Td>{formatDate(b.lastFetchedAt)}</Table.Td>
                  <Table.Td>
                    <Switch
                      aria-label={`${b.active ? 'Desligar' : 'Ligar'} ${b.token}`}
                      checked={b.active}
                      onChange={(e) =>
                        setActive.mutate({ id: b.id, active: e.currentTarget.checked })
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {data && data.total > BOARDS_PAGE_SIZE && (
        <Pagination
          total={Math.ceil(data.total / BOARDS_PAGE_SIZE)}
          value={page}
          onChange={setPage}
        />
      )}
    </Stack>
  );
}
