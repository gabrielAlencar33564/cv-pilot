'use client';

import type { Paginated } from '@cv-pilot/contracts';
import { Anchor, Badge, Card, Group, Pagination, RingProgress, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { workModelLabels } from '@/lib/labels';
import type { JobMatchRow } from '@/lib/types';

const PAGE_SIZE = 20;
const scoreColor = (s: number) => (s >= 75 ? 'green' : s >= 50 ? 'yellow' : 'gray');

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page],
    queryFn: () => api<Paginated<JobMatchRow>>(`/jobs?page=${page}&pageSize=${PAGE_SIZE}`),
  });

  return (
    <Stack>
      <Title order={2}>Vagas encontradas</Title>
      {!isLoading && !data?.items.length && (
        <Text c="dimmed">Nenhuma vaga ainda. Crie um perfil de busca e aguarde os bots.</Text>
      )}
      {data?.items.map((m) => (
        <Card key={m.id} withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={4}>
              <Text fw={600}>{m.job.title}</Text>
              <Text size="sm">
                {m.job.company}
                {m.job.location ? ` · ${m.job.location}` : ''}
              </Text>
              <Group gap={6}>
                {m.job.workModel && <Badge variant="outline">{workModelLabels[m.job.workModel]}</Badge>}
                <Badge variant="light" color="gray">
                  {m.searchProfile.name}
                </Badge>
                {m.job.sources.map((s) => (
                  <Anchor key={s.sourceId} href={s.url} target="_blank" size="sm">
                    {s.sourceId}
                  </Anchor>
                ))}
              </Group>
              {m.reasons.length > 0 && (
                <Text size="xs" c="dimmed">
                  {m.reasons.join(' · ')}
                </Text>
              )}
            </Stack>
            <RingProgress
              size={64}
              thickness={6}
              sections={[{ value: m.score, color: scoreColor(m.score) }]}
              label={<Text ta="center" size="xs" fw={700}>{m.score}%</Text>}
            />
          </Group>
        </Card>
      ))}
      {data && data.total > PAGE_SIZE && (
        <Pagination total={Math.ceil(data.total / PAGE_SIZE)} value={page} onChange={setPage} />
      )}
    </Stack>
  );
}
