import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { AppRole } from '@/types/otms';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole | AppRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, roles, profileStatus, isLoadingRoles, isLoadingProfile } = useAuth();
  const location = useLocation();

  // Wait for server state (roles, profile) to load
  const isLoading = isLoadingRoles || isLoadingProfile;

  // Precompute required roles array for diagnostics
  const requiredRoles = requiredRole
    ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole])
    : undefined;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect users with pending setup to password setup page
  if (profileStatus === 'pending_password') {
    return <Navigate to="/setup-password" replace />;
  }

  // Redirect inactive users (e.g., disabled management users) to login
  if (profileStatus === 'inactive') {
    return <Navigate to="/auth" replace />;
  }

  // Admin bypass: admins can access all routes
  if (roles.includes('admin')) {
    return <>{children}</>;
  }

  // Check role-based access if required (for non-admins)
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => roles.includes(role));
    if (!hasRequiredRole) {
      // Pass context for better diagnostics
      return (
        <Navigate
          to="/unauthorized"
          replace
          state={{ from: location.pathname, requiredRoles }}
        />
      );
    }
  }

  // User is authenticated and authorized - render protected content
  return <>{children}</>;
}