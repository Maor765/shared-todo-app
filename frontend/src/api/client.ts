import axios from 'axios';
import { onlineManager } from '@tanstack/react-query';
import { clearPersistedCache } from '../lib/queryClient';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const client = axios.create({
  baseURL,
});

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

function stopHealthCheckPolling() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function startHealthCheckPolling() {
  if (healthCheckTimer) return;
  // TanStack Query won't send a query/mutation request while onlineManager
  // reports offline, so a single unreachable request (e.g. a Render cold-start
  // timeout) would otherwise wedge the app offline forever — there'd be nothing
  // left to trigger the success path that flips it back online. Poll a
  // lightweight endpoint outside the query/mutation machinery until the backend
  // responds again, so recovery doesn't require a manual page reload.
  healthCheckTimer = setInterval(() => {
    client.get('/api/health').catch(() => {});
  }, 5000);
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('todo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    onlineManager.setOnline(true);
    stopHealthCheckPolling();
    return response;
  },
  (error) => {
    if (!error.response) {
      // No response at all (connection refused/timeout/DNS failure) means the
      // backend is unreachable — as opposed to a real HTTP error like 404/500,
      // which means the server was reached. Treat only the former as "offline"
      // so TanStack Query's mutation pause/resume and the offline banner
      // reflect actual backend reachability, not just navigator.onLine.
      onlineManager.setOnline(false);
      startHealthCheckPolling();
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('todo_token');
      clearPersistedCache();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default client;
