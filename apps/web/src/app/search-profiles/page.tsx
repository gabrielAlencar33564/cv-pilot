'use client';

import { Badge, Button, Card, Group, Modal, Stack, Switch, Text, Title } from '@mantine/core';
import { IconCopy, IconPencil, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { SearchProfileForm } from '@/features/search-profiles/SearchProfileForm';
import { useApiMutation, useSearchProfiles, useSources } from '@/features/shared/queries';
import { contractTypeLabels, workModelLabels } from '@/lib/labels';
import type { SearchProfileRow } from '@/lib/types';

/** O que o modal está fazendo: criar do zero, editar um perfil ou partir de uma cópia. */
type Editor =
  | { kind: 'create' }
  | { kind: 'edit'; profile: SearchProfileRow }
  | { kind: 'duplicate'; profile: SearchProfileRow };

const editorTitle: Record<Editor['kind'], string> = {
  create: 'Novo perfil de busca',
  edit: 'Editar perfil de busca',
  duplicate: 'Duplicar perfil de busca',
};

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function salaryRange(p: SearchProfileRow) {
  if (p.salaryMin != null && p.salaryMax != null) {
    return `${money.format(p.salaryMin)} a ${money.format(p.salaryMax)}`;
  }
  if (p.salaryMin != null) return `a partir de ${money.format(p.salaryMin)}`;
  if (p.salaryMax != null) return `até ${money.format(p.salaryMax)}`;
  return null;
}

export default function SearchProfilesPage() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const { data: profiles = [], isLoading } = useSearchProfiles();
  const { data: sources = [] } = useSources();
  const toggle = useApiMutation<{ id: string; active: boolean }>({
    path: (b) => `/search-profiles/${b.id}/active`,
    method: 'PATCH',
    invalidate: ['search-profiles'],
  });
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.displayName ?? id;
  const close = () => setEditor(null);

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>O que estou buscando</Title>
          <Text c="dimmed" size="sm">
            Cada perfil gera buscas automáticas nos sites selecionados.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({ kind: 'create' })}>
          Novo perfil
        </Button>
      </Group>

      {!isLoading && profiles.length === 0 && <Text c="dimmed">Nenhum perfil de busca ainda.</Text>}

      {profiles.map((p) => {
        const salary = salaryRange(p);
        return (
          <Card key={p.id} withBorder>
            <Group justify="space-between" align="flex-start">
              <Stack gap={6}>
                <Text fw={600}>{p.name}</Text>
                <Group gap={6}>
                  {p.keywords.map((k) => (
                    <Badge key={k} variant="light">
                      {k}
                    </Badge>
                  ))}
                  {p.workModels.map((w) => (
                    <Badge key={w} color="gray" variant="outline">
                      {workModelLabels[w] ?? w}
                    </Badge>
                  ))}
                  {p.contractTypes.map((c) => (
                    <Badge key={c} color="gray" variant="outline">
                      {contractTypeLabels[c] ?? c}
                    </Badge>
                  ))}
                </Group>
                <Text size="sm" c="dimmed">
                  Sites: {p.sourceIds.map(sourceName).join(', ')} · nota mínima{' '}
                  {p.minScoreAutoApply}%{salary ? ` · ${salary}` : ''}
                </Text>
                {p.companyBlacklist.length > 0 && (
                  <Text size="sm" c="dimmed">
                    Empresas excluídas: {p.companyBlacklist.join(', ')}
                  </Text>
                )}
              </Stack>
              <Stack gap="xs" align="flex-end">
                <Switch
                  label={p.active ? 'Ativo' : 'Pausado'}
                  checked={p.active}
                  onChange={(e) => toggle.mutate({ id: p.id, active: e.currentTarget.checked })}
                />
                <Group gap={4}>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    leftSection={<IconPencil size={14} />}
                    onClick={() => setEditor({ kind: 'edit', profile: p })}
                    aria-label={`Editar ${p.name}`}
                  >
                    Editar
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    leftSection={<IconCopy size={14} />}
                    onClick={() => setEditor({ kind: 'duplicate', profile: p })}
                    aria-label={`Duplicar ${p.name}`}
                  >
                    Duplicar
                  </Button>
                </Group>
              </Stack>
            </Group>
          </Card>
        );
      })}

      <Modal
        opened={editor !== null}
        onClose={close}
        title={editor ? editorTitle[editor.kind] : ''}
        size="lg"
      >
        {editor?.kind === 'create' && <SearchProfileForm onDone={close} />}
        {editor?.kind === 'edit' && (
          <SearchProfileForm
            initial={editor.profile}
            profileId={editor.profile.id}
            onDone={close}
          />
        )}
        {editor?.kind === 'duplicate' && (
          <SearchProfileForm
            initial={{ ...editor.profile, name: `${editor.profile.name} (cópia)` }}
            onDone={close}
          />
        )}
      </Modal>
    </Stack>
  );
}
