'use client';

import type { ApplicationUpdateInput } from '@cv-pilot/contracts';
import { Anchor, Badge, Button, Card, Group, Menu, Modal, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsExchange,
  IconMailOpened,
  IconMessageForward,
  IconNote,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { coverLetterStatusLabels, modeLabels, statusLabels } from '@/lib/labels';
import type { ApplicationRow } from '@/lib/types';
import { CoverLetterModal } from './CoverLetterModal';
import { FollowUpModal } from './FollowUpModal';

const UPDATE_ERRORS: Record<string, string> = {
  invalid_status_transition: 'Essa mudança de status não é mais possível. Atualize a página.',
  cover_letter_locked: 'A candidatura já foi enviada: a carta não muda mais.',
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
  const [letterOpen, setLetterOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
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
        {a.followUp === 'due' && (
          <Badge size="xs" variant="light" color="orange">
            Fazer follow-up
          </Badge>
        )}
        {a.coverLetterStatus && (
          <Badge
            size="xs"
            variant="light"
            color={coverLetterStatusLabels[a.coverLetterStatus].color}
          >
            {coverLetterStatusLabels[a.coverLetterStatus].label}
          </Badge>
        )}
      </Group>
      {a.notes && (
        <Text size="xs" c="dimmed" mt={6} lineClamp={2}>
          {a.notes}
        </Text>
      )}
      {a.followUp === 'stale' && (
        <Text size="xs" c="orange.8" mt={6}>
          Sem resposta uma semana depois do follow-up.{' '}
          <Anchor
            component="button"
            size="xs"
            onClick={() => update.mutate({ status: 'no_response' })}
            aria-label={`Mover ${a.job.title} para Sem resposta`}
          >
            Mover para Sem resposta
          </Anchor>
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
        {a.followUp === 'due' && (
          <Button
            size="compact-xs"
            variant="light"
            color="orange"
            leftSection={<IconMessageForward size={14} />}
            onClick={() => setFollowUpOpen(true)}
            aria-label={`Follow-up de ${a.job.title}`}
          >
            Follow-up
          </Button>
        )}
        {(a.coverLetter || a.coverLetterEditable) && (
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconMailOpened size={14} />}
            onClick={() => setLetterOpen(true)}
            aria-label={`Carta de ${a.job.title}`}
          >
            Carta
          </Button>
        )}
      </Group>

      <CoverLetterModal
        application={a}
        opened={letterOpen}
        onClose={() => setLetterOpen(false)}
        update={update}
      />

      <FollowUpModal application={a} opened={followUpOpen} onClose={() => setFollowUpOpen(false)} />

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
