'use client';

import { Alert, Anchor, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDownload, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import { CONSENT_PATH, LOGIN_PATH } from '@/lib/routes';
import { authErrorMessage, deleteAccount } from '@/lib/session';
import type { Me } from '@/lib/types';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });

/** Direitos do titular (RF-04): o aceite dos termos, exportar tudo e excluir a conta. */
export function PrivacySection({ me }: { me: Me }) {
  const [opened, { open, close }] = useDisclosure();
  const [password, setPassword] = useState('');
  const exclusao = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: () => window.location.assign(LOGIN_PATH),
  });

  return (
    <Stack>
      {me.termsAcceptedAt ? (
        <Text size="sm">
          Você aceitou os{' '}
          <Anchor component={Link} href="/termos">
            termos de uso e a política de privacidade
          </Anchor>{' '}
          (versão {me.termsVersion}) em {dateFormat.format(new Date(me.termsAcceptedAt))}.
        </Text>
      ) : (
        <Alert color="yellow" variant="light">
          Você ainda não aceitou a versão {me.termsVersion} dos termos.{' '}
          <Anchor component={Link} href={CONSENT_PATH}>
            Ler e aceitar
          </Anchor>
        </Alert>
      )}
      <Group>
        {/* a API devolve o arquivo com Content-Disposition: o navegador baixa direto */}
        <Button
          component="a"
          href={apiUrl('/me/export')}
          variant="light"
          leftSection={<IconDownload size={16} />}
        >
          Baixar meus dados (JSON)
        </Button>
        <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={open}>
          Excluir minha conta
        </Button>
      </Group>

      <Modal opened={opened} onClose={close} title="Excluir a conta">
        <Stack>
          <Text size="sm">
            Isto apaga de vez seus currículos, perfis de busca, regras de envio e candidaturas. Não
            dá para desfazer. Se quiser guardar uma cópia, baixe seus dados antes.
          </Text>
          {exclusao.error && (
            <Alert color="red" variant="light">
              {authErrorMessage(exclusao.error)}
            </Alert>
          )}
          <PasswordInput
            label="Confirme com a sua senha"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button
              color="red"
              disabled={!password}
              loading={exclusao.isPending}
              onClick={() => exclusao.mutate()}
            >
              Excluir de vez
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
