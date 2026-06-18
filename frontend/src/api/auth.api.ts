import client from './client';

export const authAPI = {
  register: (name: string, email: string, password: string, workspace_name: string) =>
    client.post('/api/auth/register', { name, email, password, workspace_name }),
  login: (email: string, password: string) =>
    client.post('/api/auth/login', { email, password }),
  getMe: () => client.get('/api/auth/me'),
  googleAuth: (credential: string) =>
    client.post('/api/auth/google', { credential }),
};
