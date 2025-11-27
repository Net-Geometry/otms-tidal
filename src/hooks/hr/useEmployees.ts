import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/otms';

export function useEmployees() {
  return useQuery({
    queryKey: ['hr-employees'],
    queryFn: async () => {
      // Fetch profiles with departments and companies relationship
      // Filter out deleted employees (deleted_at IS NULL)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(id, name, code),
          companies(id, name, code)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles separately (no FK relationship exists)
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
