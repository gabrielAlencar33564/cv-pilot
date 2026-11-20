'use client';

import { Button, CopyButton, Group, Modal, Text, Textarea } from '@mantine/core';
import { useApiMutation } from '@/features/shared/queries';
import type { ApplicationRow } from '@/lib/types';

/**
 * Follow-up de uma candidatura parada em "Enviada": a mensagem pronta para o candidato copiar
 * e mandar pelo canal que tiver (e-mail do recrutador, LinkedIn, o site da vaga). O CV Pilot não
 * envia nada: só guarda que a cobrança foi feita.
 */
export function FollowUpModal({
  application: a,
  opened,
  onClose,
}: {
  application: ApplicationRow;
  opened: boolean;
  onClose: () => void;
}) {
  const markDone = useApiMutation<Record<string, never>>({
    path: `/applications/${a.id}/follow-up`,
    invalidate: ['applications'],
    success: 'Follow-up registrado',
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Follow-up" size="lg">
      <Text size="sm" c="dimmed" mb="xs">
        {a.job.title} · {a.job.company}
      </Text>
      <Text size="sm" mb="sm">
        Faz uma semana que a candidatura foi enviada e a empresa ainda não respondeu. Uma mensagem
        educada costuma ajudar. Copie, ajuste se quiser e mande para o recrutador.
      </Text>
      <Textarea label="Mensagem" autosize minRows={6} readOnly value={a.followUpMessage ?? ''} />
      <Group justify="flex-end" mt="md">
        <CopyButton value={a.followUpMessage ?? ''}>
          {({ copied, copy }) => (
            <Button variant="default" onClick={copy}>
              {copied ? 'Copiada' : 'Copiar mensagem'}
            </Button>
          )}
        </CopyButton>
        <Button
          loading={markDone.isPending}
          onClick={() => markDone.mutate({}, { onSuccess: onClose })}
        >
          Já mandei
        </Button>
      </Group>
    </Modal>
  );
}
