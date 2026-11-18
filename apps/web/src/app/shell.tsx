'use client';

import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBriefcase,
  IconFileText,
  IconHome,
  IconListCheck,
  IconSearch,
  IconSettingsAutomation,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const links = [
  { href: '/', label: 'Início', icon: IconHome },
  { href: '/search-profiles', label: 'O que estou buscando', icon: IconSearch },
  { href: '/resumes', label: 'Currículos', icon: IconFileText },
  { href: '/send-rules', label: 'Envio por site', icon: IconSettingsAutomation },
  { href: '/jobs', label: 'Vagas', icon: IconBriefcase },
  { href: '/applications', label: 'Candidaturas', icon: IconListCheck },
];

export function Shell({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

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
            active={href === '/' ? pathname === '/' : pathname.startsWith(href)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
