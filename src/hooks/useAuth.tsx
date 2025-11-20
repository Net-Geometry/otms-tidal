import { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/types/otms';
import { toast } from 'sonner';

// Query Keys
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: (userId?: string) => [...authKeys.user(), 'profile', userId] as const,
  roles: (userId?: string) => [...authKeys.user(), 'roles', userId] as const,
} as const;

// Types
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  // ADDED: 'inactive' status for disabled accounts (e.g., management users)
  profileStatus: 'active' | 'pending_password' | 'inactive' | null;
  signIn: (email: string, password: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  isLoadingSession: boolean;
  isLoadingProfile: boolean;
  isLoadingRoles: boolean;
  getDefaultRoute: () => string;
  hasRole: (role: AppRole) => boolean;
  validateRoleCombination: (rolesToCheck: AppRole[]) => { isValid: boolean; error?: string };
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to validate role combinations
// Admin cannot be combined with other roles; all other roles can combine freely
function isValidRoleCombination(rolesToCheck: AppRole[]): { isValid: boolean; error?: string } {
  if (!rolesToCheck || rolesToCheck.length === 0) {
    return { isValid: true };
  }

  const hasAdmin = rolesToCheck.includes('admin');
  const hasOtherRoles = rolesToCheck.length > 1;

  if (hasAdmin && hasOtherRoles) {
    return {
      isValid: false,
      error: 'Admin role cannot be combined with other roles',
    };
  }

  return { isValid: true };
}

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();

  // Session Query
  const {
    data: session,
    isLoading: isLoadingSession,
    error: sessionError,
  } = useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Profile Query (depends on session)
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: authKeys.profile(session?.user?.id),
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          department:departments(id, name, code),
          position_obj:positions(*)
        `)
        .eq('id', session.user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Roles Query (depends on session)
  const {
    data: roles = [],
    isLoading: isLoadingRoles,
    error: rolesError,
  } = useQuery({
    queryKey: authKeys.roles(session?.user?.id),
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      
      if (error) {
        console.error('Roles Query Error:', error);
        throw error;
      }
      
      return (data || []).map(item => item.role as AppRole);
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Sign In Mutation
  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        // Transform Supabase errors to user-friendly messages
        let message = 'Unable to sign in. Please try again.';
        
        if (error.message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please check your credentials.';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Please check your email to confirm your account.';
        } else if (error.message.includes('Too many requests')) {
          message = 'Too many login attempts. Please try again later.';
        }
        
        throw new Error(message);
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate auth queries to refresh data
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  // Sign Out Mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      // 1) Clear local session first to stop auto-refresh loops
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore local scope sign-out errors
      }

      // 2) Attempt global sign-out; treat "no session" variants as success
      const { error } = await supabase.auth.signOut();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        const name = (error as any).name || '';
        const isIgnorable =
          msg.includes('session_not_found') ||
          msg.includes('auth session missing') ||
          name === 'AuthSessionMissingError' ||
          ((error as any).__isAuthError === true && (error as any).status === 400);

        if (!isIgnorable) {
          throw error;
        }
      }

      // 3) Fallback: purge persisted auth keys for this project ref
      try {
        const ref = 'kamtarwxydftzpewcgzs';
        localStorage.removeItem(`sb-${ref}-auth-token`);
        localStorage.removeItem(`sb-${ref}-auth-token.0`);
        localStorage.removeItem(`sb-${ref}-auth-token.1`);
      } catch {
        // ignore storage errors
      }
    },
    onSuccess: () => {
      // Clear all queries and reset auth state
      queryClient.clear();
    },
  });

  // Auth state change listener
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state changed: ${event}`, { session: !!session });
      
      // Synchronously update session cache to make UI react instantly
      queryClient.setQueryData(authKeys.session(), session);
      
      // If no session, immediately clear user-scoped caches (roles/profile)
      if (!session?.user) {
        queryClient.removeQueries({ queryKey: authKeys.user(), exact: false });
      }
      
      // When signing in, refetch roles and profile with the new session
      // Don't invalidate the session itself to avoid loading state issues
      if (session?.user) {
        queryClient.invalidateQueries({ queryKey: authKeys.user() });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Get default route based on user roles
  const getDefaultRoute = useCallback(() => {
    if (!roles.length) return '/dashboard';

    // Priority order for role-based routing
    if (roles.includes('admin')) return '/admin/dashboard';
    if (roles.includes('hr')) return '/hr/dashboard';
    if (roles.includes('management')) return '/management/dashboard';
    if (roles.includes('supervisor')) return '/supervisor/dashboard';
    if (roles.includes('employee')) return '/employee/dashboard';

    return '/dashboard';
  }, [roles]);

  // Check if user has a specific role
  const hasRole = useCallback((role: AppRole) => {
    return roles.includes(role);
  }, [roles]);

  // Validate role combinations
  const validateRoleCombination = useCallback((rolesToCheck: AppRole[]) => {
    return isValidRoleCombination(rolesToCheck);
  }, []);

  // Sign in wrapper
  const signIn = async (email: string, password: string) => {
    try {
      await signInMutation.mutateAsync({ email, password });
      return {};
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign out wrapper
  const signOut = async () => {
    try {
      await signOutMutation.mutateAsync();
    } catch (error) {
      // Only log and show errors that aren't session-not-found
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('session_not_found')) {
        console.error('Sign out error:', error);
        toast.error('Error signing out');
      }
    } finally {
      // Optimistically nullify session and clear user-scoped caches
      queryClient.setQueryData(authKeys.session(), null);
      queryClient.removeQueries({ queryKey: authKeys.user(), exact: false });
      // Then fully clear everything
      queryClient.clear();
    }
  };

  // Derive auth state directly from query data
  const user = session?.user || null;
  // ADDED: Support for 'inactive' status to disable accounts (e.g., management users)
  const profileStatus = profile?.status === 'pending_password'
    ? 'pending_password'
    : profile?.status === 'inactive'
    ? 'inactive'
    : 'active';

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    profileStatus,
    signIn,
    signOut,
    isLoadingSession,
    isLoadingProfile,
    isLoadingRoles,
    getDefaultRoute,
    hasRole,
    validateRoleCombination,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}