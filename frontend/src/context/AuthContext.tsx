import React, { createContext, useEffect, useState } from 'react';
import { PublicUser, WorkspaceInvite } from '../types';
import client from '../api/client';

export interface AuthContextValue {
  user: PublicUser | null;
  workspace: { id: string; name: string } | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, workspace_name: string) => Promise<WorkspaceInvite | null>;
  acceptInvite: (inviteId: string) => Promise<void>;
  finalizeSession: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function saveSession(token: string, user: PublicUser, workspace: { id: string; name: string }) {
  localStorage.setItem('todo_token', token);
  localStorage.setItem('todo_user', JSON.stringify(user));
  localStorage.setItem('todo_workspace', JSON.stringify(workspace));
}

function clearSession() {
  localStorage.removeItem('todo_token');
  localStorage.removeItem('todo_user');
  localStorage.removeItem('todo_workspace');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('todo_token');
    const storedUser = localStorage.getItem('todo_user');
    const storedWorkspace = localStorage.getItem('todo_workspace');

    if (storedToken && storedUser && storedWorkspace) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setWorkspace(JSON.parse(storedWorkspace));
      } catch {
        clearSession();
      }
      setIsLoading(false);
      rehydrate(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function rehydrate(tok: string) {
    try {
      const response = await client.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      setUser(response.data.user);
      setWorkspace(response.data.workspace);
      localStorage.setItem('todo_user', JSON.stringify(response.data.user));
      localStorage.setItem('todo_workspace', JSON.stringify(response.data.workspace));
    } catch (error: any) {
      if (error?.response?.status === 401) {
        clearSession();
        setToken(null);
        setUser(null);
        setWorkspace(null);
      }
      // Network/server errors: keep cached session, user stays logged in
    }
  }

  async function login(email: string, password: string) {
    const response = await client.post('/api/auth/login', { email, password });
    const { token: newToken, user: newUser, workspace: newWorkspace } = response.data;
    saveSession(newToken, newUser, newWorkspace);
    setToken(newToken);
    setUser(newUser);
    setWorkspace(newWorkspace);
  }

  async function register(name: string, email: string, password: string, workspace_name: string): Promise<WorkspaceInvite | null> {
    const response = await client.post('/api/auth/register', { name, email, password, workspace_name });
    const { token: newToken, user: newUser, workspace: newWorkspace, pendingInvite } = response.data;
    saveSession(newToken, newUser, newWorkspace);
    if (!pendingInvite) {
      setToken(newToken);
      setUser(newUser);
      setWorkspace(newWorkspace);
    }
    return pendingInvite || null;
  }

  function finalizeSession() {
    const storedToken = localStorage.getItem('todo_token');
    const storedUser = localStorage.getItem('todo_user');
    const storedWorkspace = localStorage.getItem('todo_workspace');
    if (storedToken && storedUser && storedWorkspace) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setWorkspace(JSON.parse(storedWorkspace));
    }
  }

  async function acceptInvite(inviteId: string) {
    const response = await client.post(`/api/auth/invites/${inviteId}/accept`);
    const { token: newToken, user: newUser, workspace: newWorkspace } = response.data;
    saveSession(newToken, newUser, newWorkspace);
    setToken(newToken);
    setUser(newUser);
    setWorkspace(newWorkspace);
  }

  function logout() {
    clearSession();
    setToken(null);
    setUser(null);
    setWorkspace(null);
  }

  return (
    <AuthContext.Provider value={{ user, workspace, token, isLoading, login, register, acceptInvite, finalizeSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
