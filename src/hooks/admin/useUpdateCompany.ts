import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateCompanyData {
  id: string;
  name: string;
  code: string;
  registration_no?: string;
  address?: string;
  phone?: string;
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateCompanyData) => {
      const payload = {
        name: data.name.trim(),
        code: data.code.toUpperCase(),
        registration_no: data.registration_no?.trim() || null,
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
      };

      const { data: company, error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company updated successfully');
    },
    onError: (error: unknown) => {
      const supabaseError = error as { code?: string; message?: string };

      if (supabaseError.code === '23505') {
        toast.error('Company name or code already exists');
      } else if (supabaseError.code === '42501') {
        toast.error('Insufficient permissions to update company');
      } else if (supabaseError.message) {
        toast.error(`Failed to update company: ${supabaseError.message}`);
      } else {
        toast.error('Failed to update company');
      }
    },
  });
}
