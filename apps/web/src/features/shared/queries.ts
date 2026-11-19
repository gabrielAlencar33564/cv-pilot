'use client';

import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CoverLetterTemplateRow, Me, Resume, SearchProfileRow, Source } from '@/lib/types';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me') });

export const useSources = () =>
  useQuery({ queryKey: ['sources'], queryFn: () => api<Source[]>('/sources') });

/** Intervalo de atualização da lista enquanto alguma extração de currículo está em andamento. */
const PARSE_POLL_MS = 5000;

const isParsing = (resume: Resume) => resume.versions[0]?.parseStatus === 'pending';

export const useResumes = () =>
  useQuery({
    queryKey: ['resumes'],
    queryFn: () => api<Resume[]>('/resumes'),
    refetchInterval: (query) => (query.state.data?.some(isParsing) ? PARSE_POLL_MS : false),
  });

export const useSearchProfiles = () =>
  useQuery({
    queryKey: ['search-profiles'],
    queryFn: () => api<SearchProfileRow[]>('/search-profiles'),
  });

export const useCoverLetterTemplates = () =>
  useQuery({
    queryKey: ['cover-letter-templates'],
    queryFn: () => api<CoverLetterTemplateRow[]>('/cover-letter-templates'),
  });

/** Mutation genérica com invalidação de cache e notificação. */
export function useApiMutation<TBody>(opts: {
  path: string | ((body: TBody) => string);
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  invalidate: string[];
  success?: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      api(typeof opts.path === 'function' ? opts.path(body) : opts.path, {
        method: opts.method ?? 'POST',
        body: opts.method === 'DELETE' ? undefined : JSON.stringify(body),
      }),
    onSuccess: () => {
      // dispara o refetch sem segurar a mutação até ele terminar
      for (const key of opts.invalidate) void qc.invalidateQueries({ queryKey: [key] });
      if (opts.success) notifications.show({ color: 'green', message: opts.success });
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Erro', message: err.message }),
  });
}
