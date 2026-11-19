'use client';

import { Alert, Badge, Loader, Table, Text } from '@mantine/core';
import type { AdminSourceRow, Paginated, SourceRunRow } from '@cv-pilot/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { sourceRunStatusLabels } from '@/lib/labels';
import { MS_PER_SECOND, formatDate } from './format';

const RUNS_PAGE_SIZE = 20;

/** Últimas execuções da ingestão de uma fonte, com o erro de cada uma. */
export function SourceRuns({ source }: { source: AdminSourceRow }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-sources', source.id, 'runs'],
    queryFn: () =>
      api<Paginated<SourceRunRow>>(`/admin/sources/${source.id}/runs?pageSize=${RUNS_PAGE_SIZE}`),
  });
  if (isLoading) return <Loader />;
  if (error) return <Alert color="red">Não foi possível carregar as execuções.</Alert>;
  if (!data?.items.length) {
    return <Text c="dimmed">Nenhuma execução registrada nos últimos 30 dias.</Text>;
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Quando</Table.Th>
            <Table.Th>Alvo</Table.Th>
            <Table.Th>Resultado</Table.Th>
            <Table.Th>Vagas</Table.Th>
            <Table.Th>Duração</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((run) => {
            const status = sourceRunStatusLabels[run.status];
            return (
              <Table.Tr key={run.id}>
                <Table.Td>{formatDate(run.startedAt)}</Table.Td>
                <Table.Td>{run.target}</Table.Td>
                <Table.Td>
                  <Badge color={status.color} variant="light">
                    {status.label}
                  </Badge>
                  {run.error && (
                    <Text size="xs" c="dimmed">
                      {run.error}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {run.found} lidas · {run.changed} novas ou alteradas · {run.closed} encerradas
                </Table.Td>
                <Table.Td>{(run.durationMs / MS_PER_SECOND).toFixed(1)} s</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {data.total > data.items.length && (
        <Text size="xs" c="dimmed" mt="xs">
          Mostrando as {data.items.length} mais recentes de {data.total}.
        </Text>
      )}
    </Table.ScrollContainer>
  );
}
