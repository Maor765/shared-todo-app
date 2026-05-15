import client from './client';

export const sublistsAPI = {
  createSublist: (listId: string, name: string) =>
    client.post(`/api/lists/${listId}/sublists`, { name }),
  updateSublist: (listId: string, id: string, name: string) =>
    client.patch(`/api/lists/${listId}/sublists/${id}`, { name }),
  deleteSublist: (listId: string, id: string) =>
    client.delete(`/api/lists/${listId}/sublists/${id}`),
};
