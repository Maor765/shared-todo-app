import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DBTask, DBSublist, ListWithMembers } from '../types';
import * as cache from '../lib/cachePatches';
import { showToast } from '../lib/toast';
import { OfflineMutationVars } from '../lib/offlineMutations';

const TEMP_PREFIX = 'temp-';
export const isTempId = (id: string) => id.startsWith(TEMP_PREFIX);
const newTempId = () => `${TEMP_PREFIX}${crypto.randomUUID()}`;

function isNotFound(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

export function useTaskMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<DBTask, Error, Extract<OfflineMutationVars, { type: 'createTask' }>>({
    onMutate: async (vars) => {
      const optimistic: DBTask = {
        id: vars.tempId, list_id: vars.listId, sublist_id: vars.data.sublist_id,
        text: vars.data.text, done: false, assignee_id: vars.data.assignee_id ?? null,
        due: vars.data.due ?? null, notes: vars.data.notes, amount: null, position: 0,
        created_by: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      cache.insertTask(qc, vars.listId, optimistic);
    },
    onSuccess: (task, vars) => cache.replaceTaskId(qc, vars.listId, vars.tempId, task),
    onError: (_error, vars) => cache.removeTask(qc, vars.listId, vars.tempId),
  });

  const updateMutation = useMutation<
    DBTask, Error,
    Extract<OfflineMutationVars, { type: 'updateTask' }>,
    { prevTask: DBTask | undefined }
  >({
    onMutate: async (vars) => {
      const prevTask = qc.getQueryData<ListWithMembers[]>(['lists'])
        ?.find((l) => l.id === vars.listId)?.tasks?.find((t) => t.id === vars.taskId);
      cache.patchTask(qc, vars.listId, vars.taskId, vars.data as Partial<DBTask>);
      return { prevTask };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) {
        showToast('Task was already removed — change skipped');
        cache.removeTask(qc, vars.listId, vars.taskId);
        return;
      }
      if (ctx?.prevTask) cache.patchTask(qc, vars.listId, vars.taskId, ctx.prevTask);
    },
  });

  const deleteMutation = useMutation<
    unknown, Error,
    Extract<OfflineMutationVars, { type: 'deleteTask' }>,
    { prevTask: DBTask | undefined }
  >({
    onMutate: async (vars) => {
      const prevTask = qc.getQueryData<ListWithMembers[]>(['lists'])
        ?.find((l) => l.id === vars.listId)?.tasks?.find((t) => t.id === vars.taskId);
      cache.removeTask(qc, vars.listId, vars.taskId);
      return { prevTask };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) return;
      if (ctx?.prevTask) cache.insertTask(qc, vars.listId, ctx.prevTask);
      showToast('Could not delete task — restored');
    },
  });

  const reorderMutation = useMutation<unknown, Error, Extract<OfflineMutationVars, { type: 'reorderTasks' }>>({
    onMutate: async (vars) => {
      cache.reorderTasks(qc, vars.listId, vars.orderedIds);
    },
    onError: (_error, vars) => {
      qc.invalidateQueries({ queryKey: ['list', vars.listId] });
    },
  });

  return {
    createTask: (listId: string, data: { text: string; sublist_id: string | null; assignee_id?: string | null; due?: string | null; notes: string }) =>
      createMutation.mutate({ type: 'createTask', listId, tempId: newTempId(), data }),
    updateTask: (listId: string, taskId: string, data: Record<string, unknown>) =>
      updateMutation.mutate({ type: 'updateTask', listId, taskId, data }),
    toggleTask: (listId: string, taskId: string, currentDone: boolean) =>
      updateMutation.mutate({ type: 'updateTask', listId, taskId, data: { done: !currentDone } }),
    deleteTask: (listId: string, taskId: string) =>
      deleteMutation.mutate({ type: 'deleteTask', listId, taskId }),
    reorderTasks: (listId: string, orderedIds: string[]) =>
      reorderMutation.mutate({ type: 'reorderTasks', listId, orderedIds }),
  };
}

export function useListMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<ListWithMembers, Error, Extract<OfflineMutationVars, { type: 'createList' }>>({
    onMutate: async (vars) => {
      const optimistic: ListWithMembers = {
        id: vars.tempId, workspace_id: '', name: vars.name, emoji: vars.emoji, shared: vars.shared,
        created_by: '', created_at: new Date().toISOString(), members: [], tasks: [],
      };
      cache.insertList(qc, optimistic);
    },
    onSuccess: (list, vars) => cache.replaceListId(qc, vars.tempId, list),
    onError: (_error, vars) => cache.removeList(qc, vars.tempId),
  });

  const updateMutation = useMutation<
    ListWithMembers, Error,
    Extract<OfflineMutationVars, { type: 'updateList' }>,
    { prevList: ListWithMembers | undefined }
  >({
    onMutate: async (vars) => {
      const prevList = qc.getQueryData<ListWithMembers[]>(['lists'])?.find((l) => l.id === vars.listId);
      cache.patchList(qc, vars.listId, vars.data as Partial<ListWithMembers>);
      return { prevList };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) {
        showToast('List was already removed — change skipped');
        cache.removeList(qc, vars.listId);
        return;
      }
      if (ctx?.prevList) cache.patchList(qc, vars.listId, ctx.prevList);
    },
  });

  const deleteMutation = useMutation<
    unknown, Error,
    Extract<OfflineMutationVars, { type: 'deleteList' }>,
    { prevList: ListWithMembers | undefined }
  >({
    onMutate: async (vars) => {
      const prevList = qc.getQueryData<ListWithMembers[]>(['lists'])?.find((l) => l.id === vars.listId);
      cache.removeList(qc, vars.listId);
      return { prevList };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) return;
      if (ctx?.prevList) cache.insertList(qc, ctx.prevList);
      showToast('Could not delete list — restored');
    },
  });

  return {
    createList: (name: string, emoji: string, shared: boolean) =>
      createMutation.mutate({ type: 'createList', tempId: newTempId(), name, emoji, shared }),
    updateList: (listId: string, data: Record<string, unknown>) =>
      updateMutation.mutate({ type: 'updateList', listId, data }),
    deleteList: (listId: string) =>
      deleteMutation.mutate({ type: 'deleteList', listId }),
  };
}

export function useSublistMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<DBSublist, Error, Extract<OfflineMutationVars, { type: 'createSublist' }>>({
    onMutate: async (vars) => {
      const optimistic: DBSublist = { id: vars.tempId, list_id: vars.listId, name: vars.name, created_at: new Date().toISOString() };
      cache.insertSublist(qc, vars.listId, optimistic);
    },
    onSuccess: (sublist, vars) => cache.replaceSublistId(qc, vars.listId, vars.tempId, sublist),
    onError: (_error, vars) => cache.removeSublist(qc, vars.listId, vars.tempId),
  });

  return {
    createSublist: (listId: string, name: string) =>
      createMutation.mutate({ type: 'createSublist', listId, tempId: newTempId(), name }),
  };
}
