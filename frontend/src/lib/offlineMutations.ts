import { tasksAPI } from '../api/tasks.api';
import { listsAPI } from '../api/lists.api';
import { sublistsAPI } from '../api/sublists.api';
import { DBTask, DBSublist, ListWithMembers } from '../types';

export type OfflineMutationVars =
  | { type: 'createTask'; listId: string; tempId: string; data: { text: string; sublist_id: string | null; assignee_id?: string | null; due?: string | null; notes: string } }
  | { type: 'updateTask'; listId: string; taskId: string; data: Record<string, unknown> }
  | { type: 'deleteTask'; listId: string; taskId: string }
  | { type: 'reorderTasks'; listId: string; orderedIds: string[] }
  | { type: 'createList'; tempId: string; name: string; emoji: string; shared: boolean }
  | { type: 'updateList'; listId: string; data: Record<string, unknown> }
  | { type: 'deleteList'; listId: string }
  | { type: 'createSublist'; listId: string; tempId: string; name: string };

export async function defaultMutationFn(vars: OfflineMutationVars): Promise<unknown> {
  switch (vars.type) {
    case 'createTask':
      return (await tasksAPI.createTask(vars.listId, vars.data)).data as DBTask;
    case 'updateTask':
      return (await tasksAPI.updateTask(vars.listId, vars.taskId, vars.data)).data as DBTask;
    case 'deleteTask':
      return (await tasksAPI.deleteTask(vars.listId, vars.taskId)).data;
    case 'reorderTasks':
      return (await tasksAPI.reorderTasks(vars.listId, vars.orderedIds)).data;
    case 'createList':
      return (await listsAPI.createList(vars.name, vars.emoji, vars.shared)).data as ListWithMembers;
    case 'updateList':
      return (await listsAPI.updateList(vars.listId, vars.data)).data as ListWithMembers;
    case 'deleteList':
      return (await listsAPI.deleteList(vars.listId)).data;
    case 'createSublist':
      return (await sublistsAPI.createSublist(vars.listId, vars.name)).data as DBSublist;
  }
}
