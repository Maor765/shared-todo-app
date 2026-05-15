import client from './client';

export const tasksAPI = {
  createTask: (listId: string, data: any) =>
    client.post(`/api/lists/${listId}/tasks`, data),
  updateTask: (listId: string, taskId: string, data: any) =>
    client.patch(`/api/lists/${listId}/tasks/${taskId}`, data),
  deleteTask: (listId: string, taskId: string) =>
    client.delete(`/api/lists/${listId}/tasks/${taskId}`),
};
