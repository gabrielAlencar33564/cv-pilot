'use client';

import type { ApplicationStatus } from '@cv-pilot/contracts';
import { Loader, ScrollArea, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { ApplicationCard } from '@/features/applications/ApplicationCard';
import { api } from '@/lib/api';
import { statusLabels } from '@/lib/labels';
import type { ApplicationRow } from '@/lib/types';

const COLUMN_WIDTH = 240;

const ACTIVE_STATUSES: readonly ApplicationStatus[] = [
  'suggested',
  'queued',
  'needs_action',
  'sent',
  'in_process',
  'interview',
  'offer',
];
const CLOSED_STATUSES: readonly ApplicationStatus[] = ['rejected', 'no_response', 'failed'];

/** Uma coluna por etapa do funil, e as encerradas juntas no fim (RF-60). */
const COLUMNS = [
  ...ACTIVE_STATUSES.map((status) => ({
    key: status,
    title: statusLabels[status] ?? status,
    statuses: [status],
  })),
  { key: 'closed', title: 'Encerradas', statuses: CLOSED_STATUSES },
];

export default function ApplicationsPage() {
  const {
    data: apps = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<ApplicationRow[]>('/applications'),
  });

  return (
    <Stack>
      <Title order={2}>Candidaturas</Title>
      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar as candidaturas.</Text>}
      {!isLoading && !error && apps.length === 0 && (
        <Text c="dimmed">
          Nenhuma candidatura ainda. Elas aparecem aqui quando você se candidata a uma vaga ou
          quando os bots encontram vagas com nota alta.
        </Text>
      )}
      <ScrollArea>
        <SimpleGrid cols={COLUMNS.length} miw={COLUMNS.length * COLUMN_WIDTH}>
          {COLUMNS.map((column) => {
            const items = apps.filter((a) => column.statuses.some((s) => s === a.status));
            return (
              <Stack key={column.key} gap="xs">
                <Text fw={600} size="sm">
                  {column.title} ({items.length})
                </Text>
                {items.map((a) => (
                  <ApplicationCard
                    key={a.id}
                    application={a}
                    showStatus={column.statuses.length > 1}
                  />
                ))}
              </Stack>
            );
          })}
        </SimpleGrid>
      </ScrollArea>
    </Stack>
  );
}
