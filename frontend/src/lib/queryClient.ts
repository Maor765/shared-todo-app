import { QueryClient, MutationFunction } from '@tanstack/react-query';
import { defaultMutationFn } from './offlineMutations';

export const QUERY_CACHE_KEY = 'todo_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      // A per-call-site closure mutationFn can't be serialized to localStorage,
      // so paused (offline) mutations would be lost on page reload. Registering
      // one static, serializable-variables-based function here is what lets
      // TanStack Query's persist plugin restore and resume them after reload.
      mutationFn: defaultMutationFn as unknown as MutationFunction,
    },
  },
});

export function clearPersistedCache() {
  queryClient.clear();
  localStorage.removeItem(QUERY_CACHE_KEY);
}
