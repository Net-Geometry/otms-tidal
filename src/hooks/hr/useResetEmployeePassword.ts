import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResetPasswordData {
  employeeId: string;
  email: string;
}

export function useResetEmployeePassword() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const { data: result, error } = await supabase.functions.invoke('reset-employee-password', {
        body: { employee_id: data.employeeId, email: data.email },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Password reset email sent',
        description: 'The employee will receive an email with instructions to reset their password.',
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
