'use client';

import { Button, FileButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const ACCEPTED_FILES =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Mensagens para os códigos de erro do upload; os demais aparecem como a API mandou. */
const UPLOAD_ERRORS: Record<string, string> = {
  file_too_large: 'O arquivo passa de 5 MB.',
  unsupported_file_type: 'Envie um arquivo PDF ou DOCX.',
};

/** Envia um PDF ou DOCX como nova versão do currículo; a extração dos dados começa em seguida. */
export function ResumeFileButton({ resumeId, hasFile }: { resumeId: string; hasFile: boolean }) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api(`/resumes/${resumeId}/versions`, { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resumes'] });
      notifications.show({
        color: 'green',
        message: 'Arquivo enviado. Os dados estão sendo extraídos.',
      });
    },
    onError: (err) =>
      notifications.show({
        color: 'red',
        title: 'Erro no envio',
        message: UPLOAD_ERRORS[err.message] ?? err.message,
      }),
  });

  return (
    <FileButton accept={ACCEPTED_FILES} onChange={(file) => file && upload.mutate(file)}>
      {(props) => (
        <Button
          {...props}
          size="xs"
          variant="light"
          leftSection={<IconUpload size={14} />}
          loading={upload.isPending}
        >
          {hasFile ? 'Enviar nova versão' : 'Enviar arquivo'}
        </Button>
      )}
    </FileButton>
  );
}
