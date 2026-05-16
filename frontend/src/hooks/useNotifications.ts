import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { notificationsAPI } from '../api/notifications.api';
import { DBNotification } from '../types';
import { useSocketEvent } from './useSocket';

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getNotifications().then((r) => r.data as DBNotification[]),
    staleTime: 2 * 60 * 1000,
  });

  useSocketEvent('notification:new', ({ notification }: { notification: DBNotification }) => {
    queryClient.setQueryData<DBNotification[]>(['notifications'], (prev) => [notification, ...(prev ?? [])]);
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsAPI.markRead(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<DBNotification[]>(['notifications'], (prev) =>
        (prev ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData<DBNotification[]>(['notifications'], (prev) =>
        (prev ?? []).map((n) => ({ ...n, read: true })),
      );
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    error: error ? String(error) : null,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
  };
}
