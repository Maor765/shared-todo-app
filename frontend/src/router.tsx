import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppShell from './pages/AppShell';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

const rootRoute = createRootRoute({ component: Outlet });

export const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage });
export const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage });
export const forgotPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password', component: ForgotPasswordPage });
export const resetPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: ResetPasswordPage });
export const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: AppShell });

const routeTree = rootRoute.addChildren([loginRoute, registerRoute, forgotPasswordRoute, resetPasswordRoute, indexRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
