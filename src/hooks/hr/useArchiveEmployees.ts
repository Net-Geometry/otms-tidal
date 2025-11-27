import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/otms';
import { toast } from '@/hooks/use-toast';

/**
 * Fetch all deleted (archived) employees
 */
export function useArchivedEmployees() {
  return useQuery({
    queryKey: ['archived-employees'],
    queryFn: async () => {
      // Fetch only deleted employees (deleted_at IS NOT NULL)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(id, name, code),
          companies(id, name, code)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Merge roles into profiles
      const profilesWithData = profiles?.map(profile => {
        const userRoles = roles?.filter(r => r.user_id === profile.id);
        return {
          ...profile,
          user_roles: userRoles?.map(r => ({ role: r.role })) || [],
          department: profile.departments || null,
          company: profile.companies || null
        };
      });

      return profilesWithData as Profile[];
    },
  });
}

/**
 * Restore a deleted employee
 */
export function useRestoreEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const { data, error } = await supabase.functions.invoke('restore-employee', {
        body: { employeeId },
      });

      if (error) {
        const message = (error as any)?.message || 'Failed to restore employee';
        throw new Error(message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['archived-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.refetchQueries({ queryKey: ['archived-employees'] });
      queryClient.refetchQueries({ queryKey: ['hr-employees'] });
      toast({
        title: 'Success',
        description: 'Employee restored to active status',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Permanently delete an employee (Admin only)
 */
export function useHardDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const { data, error } = await supabase.functions.invoke('hard-delete-employee', {
        body: { employeeId },
      });

      if (error) {
        const message = (error as any)?.message || 'Failed to permanently delete employee';
        if ((error as any)?.status === 403) {
          throw new Error('You do not have permission to permanently delete employees. Admin role required.');
        }
        throw new Error(message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['archived-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.refetchQueries({ queryKey: ['archived-employees'] });
      queryClient.refetchQueries({ queryKey: ['hr-employees'] });
      toast({
        title: 'Success',
        description: 'Employee permanently deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
