'use client';

import { DismissReason, type DismissJobInput } from '@cv-pilot/contracts';
import { Alert, Anchor, Button, Checkbox, Group, Select, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSend, IconThumbDown } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dismissReasonLabels, statusLabels, toOptions } from '@/lib/labels';
import type { JobMatchDetail } from '@/lib/types';

/** O que fazer quando a API recusa a candidatura. */
const APPLY_ERRORS: Record<string, { message: string; href?: string }> = {
  send_rule_required: {
    message: 'Configure uma regra de envio para este site.',
    href: '/send-rules',
  },
  resume_file_required: {
    message: 'Envie o arquivo do currículo usado na regra.',
    href: '/resumes',
  },
  daily_limit_reached: {
    message: 'O limite diário de candidaturas neste site acabou. Tente amanhã.',
  },
  already_applied: { message: 'Você já se candidatou a esta vaga.' },
};

/** Candidatar-se e "não tenho interesse" (RF-42), dentro da gaveta de detalhes. */
export function JobActions({ match, onDone }: { match: JobMatchDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<DismissReason>('not_interested');
  const [blockCompany, setBlockCompany] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['jobs'] });
    void qc.invalidateQueries({ queryKey: ['applications'] });
  };
  const apply = useMutation({
    mutationFn: () => api(`/jobs/${match.id}/apply`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      refresh();
      notifications.show({ color: 'green', message: 'Candidatura na fila de envio' });
    },
  });
  const dismiss = useMutation({
    mutationFn: (body: DismissJobInput) =>
      api(`/jobs/${match.id}/dismiss`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      refresh();
      notifications.show({ message: 'Vaga escondida da lista' });
      onDone();
    },
  });

  const applyError =
    apply.error && (APPLY_ERRORS[apply.error.message] ?? { message: apply.error.message });
  const status = match.application?.status;
  const canApply = !status || status === 'suggested';

  return (
    <Stack>
      {applyError && (
        <Alert color="red" variant="light">
          {applyError.message}{' '}
          {applyError.href && (
            <Anchor component={Link} href={applyError.href}>
              Resolver
            </Anchor>
          )}
        </Alert>
      )}
      {status && !canApply && (
        <Alert variant="light">Candidatura: {statusLabels[status] ?? status}</Alert>
      )}

      {dismissing ? (
        <Stack gap="xs">
          <Select
            label="Por que não quer esta vaga?"
            data={toOptions(dismissReasonLabels)}
            value={reason}
            allowDeselect={false}
            onChange={(v) => setReason(DismissReason.parse(v))}
          />
          <Checkbox
            label={`Não mostrar mais vagas de ${match.job.company} neste perfil`}
            checked={blockCompany}
            onChange={(e) => setBlockCompany(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDismissing(false)}>
              Cancelar
            </Button>
            <Button
              color="gray"
              loading={dismiss.isPending}
              onClick={() => dismiss.mutate({ reason, blockCompany })}
            >
              Esconder vaga
            </Button>
          </Group>
        </Stack>
      ) : (
        <Group justify="flex-end">
          <Button
            variant="default"
            leftSection={<IconThumbDown size={16} />}
            onClick={() => setDismissing(true)}
          >
            Não tenho interesse
          </Button>
          {canApply && (
            <Button
              leftSection={<IconSend size={16} />}
              loading={apply.isPending}
              onClick={() => apply.mutate()}
            >
              Candidatar
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
