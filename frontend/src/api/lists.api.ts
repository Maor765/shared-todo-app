import client from './client';

export const listsAPI = {
  getLists: () => client.get('/api/lists'),
  createList: (name: string, emoji: string, shared: boolean) =>
    client.post('/api/lists', { name, emoji, shared }),
  getListDetail: (id: string) => client.get(`/api/lists/${id}`),
  updateList: (id: string, data: any) => client.patch(`/api/lists/${id}`, data),
  deleteList: (id: string) => client.delete(`/api/lists/${id}`),
  addListMember: (id: string, userId: string) =>
    client.post(`/api/lists/${id}/members`, { userId }),
  removeListMember: (id: string, userId: string) =>
    client.delete(`/api/lists/${id}/members/${userId}`),
};
