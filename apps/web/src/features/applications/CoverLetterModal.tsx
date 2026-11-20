'use client';

import { COVER_LETTER_MAX_CHARS, type ApplicationUpdateInput } from '@cv-pilot/contracts';
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  Text,
  Textarea,
} from '@mantine/core';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import { coverLetterStatusLabels } from '@/lib/labels';
import type { ApplicationRow } from '@/lib/types';

/**
 * A carta da candidatura (RF-54): o candidato lê, copia e, até o envio, edita. A versão editada
 * vence a da IA, mesmo que ela ainda esteja escrevendo.
 */
export function CoverLetterModal({
  application: a,
  opened,
  onClose,
  update,
}: {
  application: ApplicationRow;
  opened: boolean;
  onClose: () => void;
  update: UseMutationResult<unknown, Error, ApplicationUpdateInput>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const status = a.coverLetterStatus;
  const close = () => {
    setDraft(null);
    onClose();
  };
  const save = () => update.mutate({ coverLetter: draft ?? '' }, { onSuccess: close });

  return (
    <Modal opened={opened} onClose={close} title="Carta de apresentação" size="lg">
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {a.job.title} · {a.job.company}
        </Text>
        {status && (
          <Badge size="sm" variant="light" color={coverLetterStatusLabels[status].color}>
            {coverLetterStatusLabels[status].label}
          </Badge>
        )}
      </Group>
      {status === 'generating' && (
        <Group gap="xs" mb="xs">
          <Loader size="xs" />
          <Text size="sm">
            A IA está escrevendo a carta com base na vaga e no seu currículo. Se você editar agora,
            vale a sua versão.
          </Text>
        </Group>
      )}
      {status === 'failed' && (
        <Alert variant="light" color="yellow" mb="xs">
          A IA não conseguiu escrever a carta.{' '}
          {a.coverLetter ? 'Vai o modelo da regra de envio.' : 'Escreva a sua abaixo, se quiser.'}
        </Alert>
      )}

      {draft !== null ? (
        <Textarea
          label="Texto da carta"
          description="Revise antes de enviar: só o que é verdade sobre você. Deixe vazio para ir sem carta."
          autosize
          minRows={10}
          maxRows={24}
          maxLength={COVER_LETTER_MAX_CHARS}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          data-autofocus
        />
      ) : a.coverLetter ? (
        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
          {a.coverLetter}
        </Text>
      ) : (
        status !== 'generating' && (
          <Text size="sm" c="dimmed">
            Esta candidatura vai sem carta.
          </Text>
        )
      )}

      <Group justify="flex-end" mt="md">
        {draft !== null ? (
          <>
            <Button variant="default" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button loading={update.isPending} onClick={save}>
              Salvar carta
            </Button>
          </>
        ) : (
          <>
            {a.coverLetterEditable && (
              <Button variant="default" onClick={() => setDraft(a.coverLetter ?? '')}>
                {a.coverLetter ? 'Editar carta' : 'Escrever carta'}
              </Button>
            )}
            {a.coverLetter && (
              <CopyButton value={a.coverLetter}>
                {({ copied, copy }) => (
                  <Button variant="light" onClick={copy}>
                    {copied ? 'Copiada' : 'Copiar carta'}
                  </Button>
                )}
              </CopyButton>
            )}
          </>
        )}
      </Group>
    </Modal>
  );
}
