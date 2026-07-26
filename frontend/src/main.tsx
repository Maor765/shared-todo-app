import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient, QUERY_CACHE_KEY } from './lib/queryClient';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { router } from './router';
import './index.css';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_CACHE_KEY,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <SettingsProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
          <AuthProvider>
            <SocketProvider>
              <RouterProvider router={router} />
            </SocketProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SettingsProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
