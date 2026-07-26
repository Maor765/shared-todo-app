import { QueryClient } from '@tanstack/react-query';

export const QUERY_CACHE_KEY = 'todo_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export function clearPersistedCache() {
  queryClient.clear();
  localStorage.removeItem(QUERY_CACHE_KEY);
}
