import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResetPasswordData {
  employeeId: string;
}

interface ResetPasswordResult {
  resetCode: string;
  expiresAt: string;
  message: string;
}

export function useResetEmployeePassword() {
  const { toast } = useToast();

  return useMutation<ResetPasswordResult, Error, ResetPasswordData>({
    mutationFn: async (data: ResetPasswordData) => {
      const { data: result, error } = await supabase.functions.invoke('reset-employee-password', {
        body: { employee_id: data.employeeId },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'Password reset code generated',
        description: `Reset code: ${data.resetCode} (expires in 48 hours). Share this with the employee.`,
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
