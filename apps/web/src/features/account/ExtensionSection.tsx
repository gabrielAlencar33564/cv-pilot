'use client';

import { ExtensionTokenInput, type ExtensionTokenRow } from '@cv-pilot/contracts';
import {
  Alert,
  Button,
  Code,
  CopyButton,
  Group,
  List,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlugConnected, IconPlugConnectedX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiMutation } from '@/features/shared/queries';
import { api } from '@/lib/api';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const CREATE_ERRORS: Record<string, string> = {
  extension_token_limit: 'Você já tem 5 navegadores conectados. Desconecte um antes.',
};

/** Cria a chave e mostra o token uma única vez, com o passo a passo para colar na extensão. */
function ConnectModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('Meu navegador');
  const create = useMutation({
    mutationFn: (input: ExtensionTokenInput) =>
      api<ExtensionTokenRow & { token: string }>('/extension-tokens', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['extension-tokens'] }),
  });
  const close = () => {
    create.reset();
    onClose();
  };
  const valid = ExtensionTokenInput.safeParse({ name }).success;

  return (
    <Modal opened={opened} onClose={close} title="Conectar a extensão">
      {create.data ? (
        <Stack>
          <Text size="sm">
            Esta é a chave do navegador <b>{create.data.name}</b>. Ela aparece só agora: copie e
            cole na extensão.
          </Text>
          <Code block aria-label="Chave da extensão">
            {create.data.token}
          </Code>
          <List size="sm" type="ordered">
            <List.Item>Clique no ícone do CV Pilot na barra do navegador.</List.Item>
            <List.Item>Cole a chave e clique em &quot;Conectar&quot;.</List.Item>
          </List>
          <Group justify="flex-end">
            <CopyButton value={create.data.token}>
              {({ copied, copy }) => (
                <Button variant="light" onClick={copy}>
                  {copied ? 'Copiada' : 'Copiar chave'}
                </Button>
              )}
            </CopyButton>
            <Button onClick={close}>Pronto</Button>
          </Group>
        </Stack>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate({ name });
          }}
        >
          <Stack>
            {create.error && (
              <Alert color="red" variant="light">
                {CREATE_ERRORS[create.error.message] ?? create.error.message}
              </Alert>
            )}
            <TextInput
              label="Nome deste navegador"
              description="Para reconhecer a chave depois, como “Chrome do notebook”."
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              error={valid ? null : 'Use de 2 a 60 caracteres'}
              data-autofocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valid} loading={create.isPending}>
                Gerar chave
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

/**
 * Navegadores com a extensão conectada (modo assistido, ADR 0010). A extensão preenche os
 * formulários das candidaturas em "Ação necessária", e você revisa e envia.
 */
export function ExtensionSection() {
  const [connecting, setConnecting] = useState(false);
  const [toRemove, setToRemove] = useState<ExtensionTokenRow | null>(null);
  const {
    data: tokens = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['extension-tokens'],
    queryFn: () => api<ExtensionTokenRow[]>('/extension-tokens'),
  });
  const remove = useApiMutation<{ id: string }>({
    path: (b) => `/extension-tokens/${b.id}`,
    method: 'DELETE',
    invalidate: ['extension-tokens'],
    success: 'Navegador desconectado',
  });

  return (
    <Stack>
      <Text size="sm">
        A extensão do CV Pilot abre as vagas em &quot;Ação necessária&quot; e preenche o formulário
        com o currículo, a carta e as respostas da regra de envio. Quem revisa e envia é você.
      </Text>
      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar os navegadores conectados.</Text>}
      {!isLoading && !error && tokens.length === 0 && (
        <Text size="sm" c="dimmed">
          Nenhum navegador conectado.
        </Text>
      )}
      {tokens.length > 0 && (
        <Table.ScrollContainer minWidth={480}>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Navegador</Table.Th>
                <Table.Th>Chave</Table.Th>
                <Table.Th>Último uso</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tokens.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>
                    <Code>{t.prefix}…</Code>
                  </Table.Td>
                  <Table.Td>
                    {t.lastUsedAt ? dateFormat.format(new Date(t.lastUsedAt)) : 'Nunca'}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconPlugConnectedX size={14} />}
                      onClick={() => setToRemove(t)}
                      aria-label={`Desconectar ${t.name}`}
                    >
                      Desconectar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Group>
        <Button
          variant="light"
          leftSection={<IconPlugConnected size={16} />}
          onClick={() => setConnecting(true)}
        >
          Conectar um navegador
        </Button>
      </Group>

      {connecting && <ConnectModal opened onClose={() => setConnecting(false)} />}

      <Modal opened={toRemove !== null} onClose={() => setToRemove(null)} title="Desconectar">
        <Stack>
          <Text size="sm">
            A extensão em <b>{toRemove?.name}</b> para de funcionar na hora. Para usar de novo, gere
            outra chave.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setToRemove(null)}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() =>
                toRemove &&
                remove.mutate({ id: toRemove.id }, { onSuccess: () => setToRemove(null) })
              }
            >
              Desconectar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
