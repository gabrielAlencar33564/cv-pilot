'use client';

import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { ResumeFileButton } from '@/features/resumes/ResumeFileButton';
import { useResumes } from '@/features/shared/queries';

/** Passo 1: enviar o currículo e esperar a leitura dos dados (a lista se atualiza sozinha). */
export function ResumeStep({ onReady }: { onReady: (resumeId: string) => void }) {
  const { data: resumes = [], isLoading } = useResumes();
  if (isLoading) return <Loader size="sm" />;

  // o currículo mais recente que já tem arquivo; sem nenhum, o primeiro da lista
  const resume = resumes.find((r) => r.versions.length) ?? resumes[0] ?? null;
  const latest = resume?.versions[0];

  if (!resume || !latest) {
    return (
      <Stack align="flex-start">
        <Text>
          Envie seu currículo em PDF ou DOCX (até 5 MB). A IA lê seus cargos e habilidades para
          sugerir o que buscar.
        </Text>
        <ResumeFileButton resumeId={resume?.id ?? null} hasFile={false} size="md" />
      </Stack>
    );
  }

  if (latest.parseStatus === 'pending') {
    return (
      <Group>
        <Loader size="sm" />
        <Text>Lendo seu currículo ({latest.fileName}). Isso costuma levar menos de um minuto.</Text>
      </Group>
    );
  }

  if (latest.parseStatus === 'failed') {
    return (
      <Stack align="flex-start">
        <Alert color="red" variant="light">
          Não conseguimos ler {latest.fileName}. Envie de novo, de preferência um PDF com texto
          selecionável.
        </Alert>
        <ResumeFileButton resumeId={resume.id} hasFile size="md" />
      </Stack>
    );
  }

  return (
    <Stack align="flex-start">
      <Group gap="xs">
        <IconCheck size={18} color="var(--mantine-color-green-6)" />
        <Text>
          Currículo lido: {resume.name} (versão {latest.version}).
        </Text>
      </Group>
      <Button onClick={() => onReady(resume.id)}>Ver perfis sugeridos</Button>
    </Stack>
  );
}
