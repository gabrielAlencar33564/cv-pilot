'use client';

import { AppShell, Badge, Burger, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBell,
  IconBriefcase,
  IconFileText,
  IconHome,
  IconListCheck,
  IconLogout,
  IconMailOpened,
  IconSearch,
  IconSettingsAutomation,
  IconUserCircle,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useUnreadNotifications } from '@/features/shared/queries';
import { isBarePath, LOGIN_PATH } from '@/lib/routes';
import { signOut } from '@/lib/session';

const ALERTS_PATH = '/alertas';

const links = [
  { href: '/', label: 'Início', icon: IconHome },
  { href: '/search-profiles', label: 'O que estou buscando', icon: IconSearch },
  { href: '/resumes', label: 'Currículos', icon: IconFileText },
  { href: '/send-rules', label: 'Envio por site', icon: IconSettingsAutomation },
  { href: '/cartas', label: 'Modelos de carta', icon: IconMailOpened },
  { href: '/jobs', label: 'Vagas', icon: IconBriefcase },
  { href: '/applications', label: 'Candidaturas', icon: IconListCheck },
  { href: ALERTS_PATH, label: 'Alertas', icon: IconBell },
  { href: '/conta', label: 'Minha conta', icon: IconUserCircle },
];

/** Contador de alertas não lidos ao lado do item do menu. */
function UnreadBadge() {
  const { data } = useUnreadNotifications();
  if (!data?.count) return null;
  return (
    <Badge size="sm" circle aria-label={`${data.count} alertas não lidos`}>
      {data.count}
    </Badge>
  );
}

async function sair() {
  await signOut();
  // recarrega a página inteira: nada da conta fica no cache das queries
  window.location.assign(LOGIN_PATH);
}

export function Shell({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

  // entrada, cadastro, termos e aceite aparecem sem o menu
  if (isBarePath(pathname)) return <main>{children}</main>;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={4}>CV Pilot</Title>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {links.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            component={Link}
            href={href}
            label={label}
            leftSection={<Icon size={18} />}
            rightSection={href === ALERTS_PATH ? <UnreadBadge /> : undefined}
            active={href === '/' ? pathname === '/' : pathname.startsWith(href)}
            onClick={close}
          />
        ))}
        <NavLink
          mt="auto"
          label="Sair"
          leftSection={<IconLogout size={18} />}
          onClick={() => void sair()}
        />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
