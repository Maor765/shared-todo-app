import client from './client';

export const notificationsAPI = {
  getNotifications: () => client.get('/api/notifications'),
  markRead: (id: string) => client.patch(`/api/notifications/${id}/read`),
  markAllRead: () => client.post('/api/notifications/read-all'),
};
