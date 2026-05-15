import { useState, useEffect } from 'react';
import { listsAPI } from '../api/lists.api';
import { ListWithMembers, ListDetail } from '../types';
import { useSocketEvent } from './useSocket';

export function useLists() {
  const [lists, setLists] = useState<ListWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = async () => {
    try {
      setIsLoading(true);
      const response = await listsAPI.getLists();
      setLists(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch lists');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  useSocketEvent('list:created', ({ list }) => {
    setLists((prev) => [...prev, list]);
  });

  useSocketEvent('list:deleted', ({ list_id }) => {
    setLists((prev) => prev.filter((l) => l.id !== list_id));
  });

  useSocketEvent('task:created', ({ task, list_id }) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === list_id ? { ...l, tasks: [...(l.tasks || []), task] } : l,
      ),
    );
  });

  useSocketEvent('task:updated', ({ task, list_id }) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === list_id
          ? {
              ...l,
              tasks: (l.tasks || []).map((t) => (t.id === task.id ? task : t)),
            }
          : l,
      ),
    );
  });

  useSocketEvent('task:deleted', ({ task_id, list_id }) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === list_id
          ? { ...l, tasks: (l.tasks || []).filter((t) => t.id !== task_id) }
          : l,
      ),
    );
  });

  return { lists, isLoading, error, refetch: fetchLists };
}

export function useListDetail(listId: string) {
  const [list, setList] = useState<ListDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setIsLoading(true);
      const response = await listsAPI.getListDetail(listId);
      setList(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch list');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [listId]);

  useSocketEvent('task:created', ({ task, list_id }) => {
    if (list_id === listId) {
      setList((prev) =>
        prev ? { ...prev, tasks: [...prev.tasks, task] } : null,
      );
    }
  });

  useSocketEvent('task:updated', ({ task, list_id }) => {
    if (list_id === listId) {
      setList((prev) =>
        prev
          ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)) }
          : null,
      );
    }
  });

  useSocketEvent('task:deleted', ({ task_id, list_id }) => {
    if (list_id === listId) {
      setList((prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== task_id) } : null,
      );
    }
  });

  useSocketEvent('sublist:created', ({ sublist, list_id }) => {
    if (list_id === listId) {
      setList((prev) =>
        prev ? { ...prev, sublists: [...prev.sublists, sublist] } : null,
      );
    }
  });

  useSocketEvent('sublist:deleted', ({ sublist_id, list_id }) => {
    if (list_id === listId) {
      setList((prev) =>
        prev
          ? { ...prev, sublists: prev.sublists.filter((s) => s.id !== sublist_id) }
          : null,
      );
    }
  });

  return { list, isLoading, error, refetch: fetchList };
}
