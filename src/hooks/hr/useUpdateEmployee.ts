import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Profile, AppRole } from '@/types/otms';

interface UpdateEmployeeData {
  id: string;
  full_name?: string;
  employee_id?: string;
  ic_no?: string | null;
  phone_no?: string | null;
  email?: string;
  company_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  position?: string | null;
  basic_salary?: number;
  ot_base?: number | null;
  employment_type?: string | null;
  designation?: string | null;
  supervisor_id?: string | null;
  joining_date?: string | null;
  work_location?: string | null;
  state?: string | null;
  status?: string;
  is_ot_eligible?: boolean;
  require_ot_attachment?: boolean;
  roles?: AppRole[];
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateEmployeeData) => {
      const { id, roles, ...profileData } = data;
      
      // Note: employee_id is intentionally never updatable - it's a permanent identifier

      // Whitelist of valid profiles table columns
      const allowedColumns = [
        'full_name', 'employee_id', 'ic_no', 'phone_no', 'email',
        'company_id', 'department_id', 'position_id', 'position', 'basic_salary',
        'ot_base', 'employment_type',
        'designation', 'supervisor_id', 'joining_date', 'work_location',
        'state', 'status', 'is_ot_eligible', 'require_ot_attachment'
      ];

      // Nullable fields that should convert empty strings to null
      const nullableFields = [
        'ic_no', 'phone_no', 'company_id', 'department_id',
        'employment_type', 'position', 'supervisor_id',
        'joining_date', 'work_location', 'state', 'position_id',
        'ot_base'
      ];

      // Sanitize the update payload
      const updateBody: Record<string, any> = {};
      Object.keys(profileData).forEach(key => {
        if (allowedColumns.includes(key)) {
          const value = profileData[key as keyof typeof profileData];
          // Convert empty strings to null for nullable fields
          if (nullableFields.includes(key) && value === '') {
            updateBody[key] = null;
          } else if (value !== undefined) {
            updateBody[key] = value;
          }
        }
      });

      // Check for duplicate employee_id if it's being changed
      if (updateBody.employee_id) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, employee_id')
          .eq('employee_id', updateBody.employee_id)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          throw new Error(`Employee No ${updateBody.employee_id} already exists. Please use a unique Employee No.`);
        }
      }

      // Update profile with sanitized data
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateBody)
        .eq('id', id);

      if (profileError) throw profileError;

      // If email is being updated, sync it with auth.users table
      if (updateBody.email) {
        const { error: emailSyncError } = await supabase.functions.invoke(
          'fix-account-email',
          {
            body: {
              user_id: id,
              new_email: updateBody.email,
            },
          }
        );

        if (emailSyncError) {
          console.error('Failed to sync email with auth.users:', emailSyncError);
          throw new Error(
            'Profile updated but failed to sync email with authentication system. User may not be able to login with new email.'
          );
        }
      }

      // Update roles if provided
      if (roles && roles.length > 0) {
        // Use the database function to validate and update roles
        const { data, error: functionError } = await supabase
          .rpc('update_user_roles', {
            _user_id: id,
            _roles: roles,
          });

        if (functionError) throw functionError;
        if (data && data.length > 0) {
          const result = data[0];
          if (!result.success) {
            throw new Error(result.error_message || 'Failed to update roles');
          }
        }
      } else if (roles !== undefined && roles.length === 0) {
        // If roles array is explicitly empty, delete all roles
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', id);

        if (deleteError) throw deleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      // Also invalidate auth-related queries in case the user's own roles changed
      queryClient.invalidateQueries({ queryKey: ['auth-roles'] });
      toast({
        title: 'Success',
        description: 'Employee updated successfully',
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
