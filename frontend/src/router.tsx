import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppShell from './pages/AppShell';

const rootRoute = createRootRoute({ component: Outlet });

export const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage });
export const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage });
export const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: AppShell });

const routeTree = rootRoute.addChildren([loginRoute, registerRoute, indexRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
