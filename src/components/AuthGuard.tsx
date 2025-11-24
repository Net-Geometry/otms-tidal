import { useAuth } from '@/hooks/useAuth';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Navigate, useLocation } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoadingSession, isLoadingRoles, isLoadingProfile, getDefaultRoute, profile } = useAuth();
  const location = useLocation();

  // Show loading skeleton while checking authentication or roles
  if (isLoadingSession || (user && isLoadingRoles) || (user && isLoadingProfile)) {
    return <LoadingSkeleton />;
  }

  // If user is not authenticated and not on auth-related pages, redirect to auth
  const isAuthPage = ['/auth', '/set-password', '/setup-password', '/change-password', '/reset-password'].includes(location.pathname);

  if (!user && !isAuthPage) {
    return <Navigate to="/auth" replace />;
  }

  // If user needs to reset password (from admin reset), redirect to reset password page
  if (user && profile?.password_change_required && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  // If user is authenticated and on auth page, redirect to their role-based dashboard
  // Only redirect after roles have loaded to ensure proper role-based routing
  if (user && location.pathname === '/auth' && !isLoadingRoles) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  return <>{children}</>;
}