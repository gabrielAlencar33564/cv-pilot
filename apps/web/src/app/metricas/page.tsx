'use client';

import type { ApplicationMetrics } from '@cv-pilot/contracts';
import { Card, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { FunnelTable, percent } from '@/features/metrics/FunnelTable';
import { api } from '@/lib/api';

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} mt={4}>
        {value}
      </Text>
      {detail && (
        <Text size="xs" c="dimmed">
          {detail}
        </Text>
      )}
    </Card>
  );
}

/**
 * Métricas das candidaturas (RF-63): qual currículo funciona melhor em qual site. Só contam as
 * enviadas, e cada etapa conta quem chegou a ela em algum momento.
 */
export default function MetricsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications', 'metrics'],
    queryFn: () => api<ApplicationMetrics>('/applications/metrics'),
  });

  return (
    <Stack>
      <div>
        <Title order={2}>Métricas</Title>
        <Text c="dimmed" size="sm">
          Quantas candidaturas enviadas tiveram resposta, entrevista e oferta, por currículo e por
          site. Atualize o status no painel de candidaturas para os números saírem certos.
        </Text>
      </div>

      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar as métricas.</Text>}
      {data && data.totals.sent === 0 && (
        <Text c="dimmed">
          Nenhuma candidatura enviada ainda. Quando você marcar uma como enviada, ela entra aqui.
        </Text>
      )}

      {data && data.totals.sent > 0 && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Stat label="Enviadas" value={String(data.totals.sent)} />
            <Stat
              label="Respostas"
              value={percent(data.totals.responded, data.totals.sent)}
              detail={`${data.totals.responded} de ${data.totals.sent}`}
            />
            <Stat
              label="Entrevistas"
              value={percent(data.totals.interviews, data.totals.sent)}
              detail={`${data.totals.interviews} de ${data.totals.sent}`}
            />
            <Stat label="Ofertas" value={String(data.totals.offers)} />
          </SimpleGrid>

          <Title order={4}>Por currículo</Title>
          <FunnelTable
            columns={['Currículo']}
            rows={data.byResume.map((r) => ({ ...r, key: r.resumeId, labels: [r.resumeName] }))}
          />

          <Title order={4}>Por site</Title>
          <FunnelTable
            columns={['Site']}
            rows={data.bySource.map((s) => ({ ...s, key: s.sourceId, labels: [s.sourceName] }))}
          />

          <Title order={4}>Currículo × site</Title>
          <Text size="sm" c="dimmed" mt={-8}>
            Compare os currículos dentro do mesmo site para saber qual usar em cada um.
          </Text>
          <FunnelTable
            columns={['Currículo', 'Site']}
            rows={data.byResumeAndSource.map((p) => ({
              ...p,
              key: `${p.resumeId}:${p.sourceId}`,
              labels: [p.resumeName, p.sourceName],
            }))}
          />
        </>
      )}
    </Stack>
  );
}
