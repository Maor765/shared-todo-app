import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listsAPI } from '../api/lists.api';
import { ListWithMembers, ListDetail, DBTask, DBSublist } from '../types';
import { useSocketEvent } from './useSocket';

export function useLists() {
  const queryClient = useQueryClient();

  const { data: rawLists = [], isLoading, error } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsAPI.getLists().then((r) => r.data as ListWithMembers[]),
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity, // never evict — useLists unmounts while in ListDetail, cache must survive
  });

  // Merge tasks from any cached ListDetail entries — detail cache is authoritative
  // when present since it's updated by useListDetail socket handlers even while
  // useLists is unmounted (e.g. while the user is inside ListDetail).
  const lists = useMemo<ListWithMembers[]>(
    () =>
      rawLists.map((l) => {
        const detail = queryClient.getQueryData<ListDetail>(['list', l.id]);
        if (detail) return { ...l, tasks: detail.tasks };
        return l;
      }),
    [rawLists], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useSocketEvent('list:created', ({ list }: { list: ListWithMembers }) => {
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) => [...(prev ?? []), list]);
  });

  useSocketEvent('list:deleted', ({ list_id }: { list_id: string }) => {
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) => (prev ?? []).filter((l) => l.id !== list_id));
  });

  useSocketEvent('task:created', ({ task, list_id }: { task: DBTask; list_id: string }) => {
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) => (l.id === list_id ? { ...l, tasks: [...(l.tasks || []), task] } : l)),
    );
  });

  useSocketEvent('task:updated', ({ task, list_id }: { task: DBTask; list_id: string }) => {
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === list_id ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === task.id ? task : t)) } : l,
      ),
    );
  });

  useSocketEvent('task:deleted', ({ task_id, list_id }: { task_id: string; list_id: string }) => {
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === list_id ? { ...l, tasks: (l.tasks || []).filter((t) => t.id !== task_id) } : l,
      ),
    );
  });

  return { lists, isLoading, error: error ? String(error) : null };
}

export function useListDetail(listId: string) {
  const queryClient = useQueryClient();

  const { data: list = null, isLoading, error } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsAPI.getListDetail(listId).then((r) => r.data as ListDetail),
    staleTime: 2 * 60 * 1000,
    gcTime: Infinity,
    enabled: !!listId,
  });

  useSocketEvent('task:created', ({ task, list_id }: { task: DBTask; list_id: string }) => {
    if (list_id !== listId) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: [...prev.tasks, task] } : prev,
    );
    // Mirror to ['lists'] so Dashboard stays current when useLists is not mounted
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) => (l.id === list_id ? { ...l, tasks: [...(l.tasks || []), task] } : l)),
    );
  });

  useSocketEvent('task:updated', ({ task, list_id }: { task: DBTask; list_id: string }) => {
    if (list_id !== listId) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === list_id ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === task.id ? task : t)) } : l,
      ),
    );
  });

  useSocketEvent('task:deleted', ({ task_id, list_id }: { task_id: string; list_id: string }) => {
    if (list_id !== listId) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== task_id) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === list_id ? { ...l, tasks: (l.tasks || []).filter((t) => t.id !== task_id) } : l,
      ),
    );
  });

  useSocketEvent('sublist:created', ({ sublist, list_id }: { sublist: DBSublist; list_id: string }) => {
    if (list_id !== listId) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, sublists: [...prev.sublists, sublist] } : prev,
    );
  });

  useSocketEvent('sublist:deleted', ({ sublist_id, list_id }: { sublist_id: string; list_id: string }) => {
    if (list_id !== listId) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, sublists: prev.sublists.filter((s) => s.id !== sublist_id) } : prev,
    );
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['list', listId] });

  return { list, isLoading, error: error ? String(error) : null, refetch };
}
