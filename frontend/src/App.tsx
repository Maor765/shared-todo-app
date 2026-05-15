import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppShell from './pages/AppShell';

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#aaa', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={auth.user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/register" element={auth.user ? <Navigate to="/" /> : <RegisterPage />} />
      <Route path="*" element={auth.user ? <AppShell /> : <Navigate to="/login" />} />
    </Routes>
  );
}
