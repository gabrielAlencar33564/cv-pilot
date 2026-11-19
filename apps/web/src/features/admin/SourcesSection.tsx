'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconAdjustments, IconHistory } from '@tabler/icons-react';
import type { AdminSourceRow } from '@cv-pilot/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiMutation } from '@/features/shared/queries';
import { api } from '@/lib/api';
import { sourceHealthLabels } from '@/lib/labels';
import { formatDate } from './format';
import { RateLimitForm } from './RateLimitForm';
import { SourceRuns } from './SourceRuns';

export const useAdminSources = (enabled = true) =>
  useQuery({
    queryKey: ['admin-sources'],
    queryFn: () => api<AdminSourceRow[]>('/admin/sources'),
    enabled,
  });

function HealthBadge({ source }: { source: AdminSourceRow }) {
  const { label, color } = sourceHealthLabels[source.health];
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
}

/** Fontes de vagas com a saúde das últimas 24 h, ligar e desligar, limite e execuções. */
export function SourcesSection() {
  const { data: sources = [], isLoading, error } = useAdminSources();
  const [toPause, setToPause] = useState<AdminSourceRow | null>(null);
  const [limitOf, setLimitOf] = useState<AdminSourceRow | null>(null);
  const [runsOf, setRunsOf] = useState<AdminSourceRow | null>(null);
  const setActive = useApiMutation<{ id: string; active: boolean }>({
    path: (b) => `/admin/sources/${b.id}`,
    method: 'PATCH',
    invalidate: ['admin-sources'],
  });
  const toggle = (source: AdminSourceRow, active: boolean) => {
    // desligar pede confirmação; religar é imediato
    if (!active) return setToPause(source);
    setActive.mutate({ id: source.id, active: true });
  };

  if (isLoading) return <Loader />;
  if (error) return <Alert color="red">Não foi possível carregar as fontes.</Alert>;
  if (!sources.length) {
    return <Text c="dimmed">Nenhuma fonte cadastrada. Rode o seed para criar as iniciais.</Text>;
  }

  return (
    <>
      <Table.ScrollContainer minWidth={880}>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fonte</Table.Th>
              <Table.Th>Saúde (24 h)</Table.Th>
              <Table.Th>Execuções (24 h)</Table.Th>
              <Table.Th>Vagas lidas (24 h)</Table.Th>
              <Table.Th>Vagas abertas</Table.Th>
              <Table.Th>Última execução</Table.Th>
              <Table.Th>Ativa</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sources.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {s.displayName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.kind}
                    {s.careerBoards ? ` · ${s.careerBoards} empresas no catálogo` : ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <HealthBadge source={s} />
                  {s.lastError && (
                    <Text size="xs" c="red" lineClamp={2} title={s.lastError}>
                      {s.lastError}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {s.runs24h} ({s.failures24h} com problema)
                </Table.Td>
                <Table.Td>{s.found24h}</Table.Td>
                <Table.Td>{s.openJobs}</Table.Td>
                <Table.Td>{formatDate(s.lastRunAt)}</Table.Td>
                <Table.Td>
                  <Switch
                    aria-label={`${s.active ? 'Desligar' : 'Ligar'} ${s.displayName}`}
                    checked={s.active}
                    onChange={(e) => toggle(s, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Limite de requisições">
                      <ActionIcon
                        variant="subtle"
                        aria-label={`Limite de requisições de ${s.displayName}`}
                        onClick={() => setLimitOf(s)}
                      >
                        <IconAdjustments size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Execuções">
                      <ActionIcon
                        variant="subtle"
                        aria-label={`Execuções de ${s.displayName}`}
                        onClick={() => setRunsOf(s)}
                      >
                        <IconHistory size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={toPause !== null} onClose={() => setToPause(null)} title="Desligar fonte">
        <Text size="sm">
          Desligar {toPause?.displayName}? O bot para de buscar vagas nela na próxima rodada, e as
          vagas já coletadas continuam visíveis até expirarem. Dá para religar quando quiser.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setToPause(null)}>
            Cancelar
          </Button>
          <Button
            color="red"
            loading={setActive.isPending}
            onClick={() =>
              toPause &&
              setActive.mutate(
                { id: toPause.id, active: false },
                { onSuccess: () => setToPause(null) },
              )
            }
          >
            Desligar
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={limitOf !== null}
        onClose={() => setLimitOf(null)}
        title={`Limite de requisições: ${limitOf?.displayName ?? ''}`}
      >
        {limitOf && <RateLimitForm source={limitOf} onDone={() => setLimitOf(null)} />}
      </Modal>

      <Modal
        opened={runsOf !== null}
        onClose={() => setRunsOf(null)}
        title={`Execuções: ${runsOf?.displayName ?? ''}`}
        size="xl"
      >
        {runsOf && <SourceRuns source={runsOf} />}
      </Modal>
    </>
  );
}
