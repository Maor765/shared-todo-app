import client from './client';

export const membersAPI = {
  getInvites: () => client.get('/api/workspace/members/invites'),
  deleteInvite: (inviteId: string) => client.delete(`/api/workspace/members/invites/${inviteId}`),
};
