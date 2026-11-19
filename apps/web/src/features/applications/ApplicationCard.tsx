'use client';

import type { ApplicationUpdateInput } from '@cv-pilot/contracts';
import { Anchor, Badge, Button, Card, Group, Menu, Modal, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowsExchange, IconNote } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { modeLabels, statusLabels } from '@/lib/labels';
import type { ApplicationRow } from '@/lib/types';

const UPDATE_ERRORS: Record<string, string> = {
  invalid_status_transition: 'Essa mudança de status não é mais possível. Atualize a página.',
  application_not_found: 'Candidatura não encontrada.',
};

/** Card do kanban: troca de status pelas transições permitidas e anotações (RF-62). */
export function ApplicationCard({
  application: a,
  showStatus,
}: {
  application: ApplicationRow;
  /** na coluna que junta vários status ("Encerradas"), o card diz qual é o seu */
  showStatus: boolean;
}) {
  const qc = useQueryClient();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const update = useMutation({
    mutationFn: (body: ApplicationUpdateInput) =>
      api(`/applications/${a.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['applications'] }),
    onError: (err) =>
      notifications.show({
        color: 'red',
        title: 'Erro',
        message: UPDATE_ERRORS[err.message] ?? err.message,
      }),
  });

  const openNotes = () => {
    setNotes(a.notes ?? '');
    setNotesOpen(true);
  };

  return (
    <Card withBorder padding="sm">
      <Text size="sm" fw={600}>
        {a.job.title}
      </Text>
      <Text size="xs" c="dimmed">
        {a.job.company} · {a.source.displayName}
      </Text>
      <Text size="xs" mt={4}>
        {a.resumeVersion.resume.name} v{a.resumeVersion.version}
      </Text>
      <Group gap={4} mt={6}>
        <Badge size="xs" variant="light">
          {modeLabels[a.mode] ?? a.mode}
        </Badge>
        {showStatus && (
          <Badge size="xs" variant="outline" color="gray">
            {statusLabels[a.status] ?? a.status}
          </Badge>
        )}
      </Group>
      {a.notes && (
        <Text size="xs" c="dimmed" mt={6} lineClamp={2}>
          {a.notes}
        </Text>
      )}
      {a.status === 'suggested' && (
        <Anchor component={Link} href="/jobs" size="xs" mt={6}>
          Revisar e candidatar em Vagas
        </Anchor>
      )}

      <Group gap={4} mt="xs">
        {a.allowedTransitions.length > 0 && (
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<IconArrowsExchange size={14} />}
                loading={update.isPending}
                aria-label={`Mudar o status de ${a.job.title}`}
              >
                Mover
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Mover para</Menu.Label>
              {a.allowedTransitions.map((status) => (
                <Menu.Item key={status} onClick={() => update.mutate({ status })}>
                  {statusLabels[status] ?? status}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<IconNote size={14} />}
          onClick={openNotes}
          aria-label={`Anotações de ${a.job.title}`}
        >
          Anotações
        </Button>
      </Group>

      <Modal opened={notesOpen} onClose={() => setNotesOpen(false)} title="Anotações">
        <Text size="sm" c="dimmed" mb="xs">
          {a.job.title} · {a.job.company}
        </Text>
        <Textarea
          label="Suas anotações"
          description="Contatos, datas de entrevista, próximos passos. Só você vê."
          autosize
          minRows={4}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setNotesOpen(false)}>
            Cancelar
          </Button>
          <Button
            loading={update.isPending}
            onClick={() => update.mutate({ notes }, { onSuccess: () => setNotesOpen(false) })}
          >
            Salvar
          </Button>
        </Group>
      </Modal>
    </Card>
  );
}
