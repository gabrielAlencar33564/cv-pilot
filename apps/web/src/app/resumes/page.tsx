'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { ResumeFileButton } from '@/features/resumes/ResumeFileButton';
import { useApiMutation, useResumes } from '@/features/shared/queries';
import { parseStatusLabels } from '@/lib/labels';
import type { Resume } from '@/lib/types';

type ResumeForm = { name: string; description: string; tags: string[] };

export default function ResumesPage() {
  const [opened, { open, close }] = useDisclosure();
  const { data: resumes = [] } = useResumes();
  const create = useApiMutation<ResumeForm>({
    path: '/resumes',
    invalidate: ['resumes'],
    success: 'Currículo criado',
  });
  const form = useForm<ResumeForm>({
    initialValues: { name: '', description: '', tags: [] },
    validate: { name: (v) => (v.trim().length >= 2 ? null : 'Informe um nome') },
  });

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Currículos</Title>
          <Text c="dimmed" size="sm">
            Tenha versões diferentes para cada tipo de site: técnico, humanizado, em inglês...
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Novo currículo
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {resumes.map((r) => (
          <Card key={r.id} withBorder>
            <Text fw={600}>{r.name}</Text>
            {r.description && (
              <Text size="sm" c="dimmed">
                {r.description}
              </Text>
            )}
            <Group gap={6} mt="xs">
              {r.tags.map((t) => (
                <Badge key={t} variant="light">
                  {t}
                </Badge>
              ))}
            </Group>
            <LatestVersion resume={r} />
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="Novo currículo">
        <form
          onSubmit={form.onSubmit((v) =>
            create.mutate(v, {
              onSuccess: () => {
                form.reset();
                close();
              },
            }),
          )}
        >
          <Stack>
            <TextInput label="Nome" placeholder="CV Técnico" {...form.getInputProps('name')} />
            <Textarea
              label="Descrição"
              placeholder="Focado em vagas de tecnologia"
              {...form.getInputProps('description')}
            />
            <TagsInput label="Tags" placeholder="técnico, inglês" {...form.getInputProps('tags')} />
            <Text size="xs" c="dimmed">
              Depois de salvar, envie o arquivo (PDF ou DOCX, até 5 MB) no card do currículo.
            </Text>
            <Group justify="flex-end">
              <Button type="submit" loading={create.isPending}>
                Salvar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

/** Última versão enviada, o estado da extração dos dados e o botão de envio. */
function LatestVersion({ resume }: { resume: Resume }) {
  const latest = resume.versions[0];
  const status = latest && parseStatusLabels[latest.parseStatus];
  return (
    <Stack gap={6} mt="sm">
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          {latest ? `Versão ${latest.version} · ${latest.fileName}` : 'Sem arquivo enviado'}
        </Text>
        {status && (
          <Badge size="xs" variant="light" color={status.color}>
            {status.label}
          </Badge>
        )}
      </Group>
      <Group>
        <ResumeFileButton resumeId={resume.id} hasFile={Boolean(latest)} />
      </Group>
    </Stack>
  );
}
