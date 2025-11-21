import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InviteEmployeeData {
  email: string | null;
  full_name: string;
  employee_id: string;
  ic_no: string | null;
  phone_no: string | null;
  position: string;
  position_id: string;
  department_id: string;
  company_id: string;
  basic_salary: number;
  employment_type: string;
  joining_date: string;
  work_location: string;
  supervisor_id: string | null;
  role: 'employee' | 'supervisor' | 'hr' | 'management' | 'admin';
  is_ot_eligible: boolean;
}

export function useInviteEmployee() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InviteEmployeeData) => {
      const { data: result, error } = await supabase.functions.invoke('invite-employee', {
        body: data,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast({
        title: '✅ Employee Added Successfully!',
        description: 'Employee can log in using their Employee ID with temporary password: Temp@12345',
        duration: 10000,
      });
    },
    onError: (error: any) => {
      console.error('Failed to invite employee:', error);
      
      let errorMessage = 'Failed to add employee';
      
      // Try to extract the actual error message from the edge function response
      if (error.message) {
        // Check if the message contains a JSON error object at the end
        const jsonMatch = error.message.match(/\{.*"error".*\}$/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            errorMessage = parsed.error || errorMessage;
          } catch {
            // If JSON parsing fails, use the original message
            errorMessage = error.message;
          }
        } else {
          // Use the message directly if no JSON found
          errorMessage = error.message;
        }
      }
      
      // Fallback to error object properties
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details) {
        errorMessage = error.details;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}
