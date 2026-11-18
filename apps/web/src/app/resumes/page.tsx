'use client';

import { Badge, Button, Card, Group, Modal, SimpleGrid, Stack, TagsInput, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useApiMutation, useResumes } from '@/features/shared/queries';

type ResumeForm = { name: string; description: string; tags: string[] };

export default function ResumesPage() {
  const [opened, { open, close }] = useDisclosure();
  const { data: resumes = [] } = useResumes();
  const create = useApiMutation<ResumeForm>({ path: '/resumes', invalidate: ['resumes'], success: 'Currículo criado' });
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
            <Text size="xs" c="dimmed" mt="sm">
              {r.versions.length ? `Versão ${r.versions[0]?.version} · ${r.versions[0]?.fileName}` : 'Sem arquivo enviado'}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="Novo currículo">
        <form onSubmit={form.onSubmit((v) => create.mutate(v, { onSuccess: () => { form.reset(); close(); } }))}>
          <Stack>
            <TextInput label="Nome" placeholder="CV Técnico" {...form.getInputProps('name')} />
            <Textarea label="Descrição" placeholder="Focado em vagas de tecnologia" {...form.getInputProps('description')} />
            <TagsInput label="Tags" placeholder="técnico, inglês" {...form.getInputProps('tags')} />
            {/* TODO: upload do PDF/DOCX (@mantine/dropzone → API multipart → S3) */}
            <Text size="xs" c="dimmed">
              O upload do arquivo será adicionado na próxima etapa.
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
