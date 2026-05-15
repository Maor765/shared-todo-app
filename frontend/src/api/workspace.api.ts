import client from './client';

export const workspaceAPI = {
  getWorkspace: () => client.get('/api/workspace'),
  updateWorkspace: (name: string) => client.patch('/api/workspace', { name }),
  getMembers: () => client.get('/api/workspace/members'),
  inviteMember: (email: string, role: string) =>
    client.post('/api/workspace/members/invite', { email, role }),
  updateStatus: (status: string) =>
    client.patch(`/api/workspace/members/${status}/status`, { status }),
  removeMember: (userId: string) =>
    client.delete(`/api/workspace/members/${userId}`),
};
