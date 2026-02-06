import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateCompanyProfileData {
  name?: string;
  registration_no?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
}

export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCompanyProfileData) => {
      // First check if a profile exists
      const { data: existing } = await supabase
        .from('company_profile')
        .select('id')
        .maybeSingle();

      let profile;
      let error;

      if (existing?.id) {
        // Update existing profile
        const result = await supabase
          .from('company_profile')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        profile = result.data;
        error = result.error;
      } else {
        // Insert new profile
        const result = await supabase
          .from('company_profile')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        profile = result.data;
        error = result.error;
      }

      if (error) throw error;
      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      toast.success('Company profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update company profile', {
        description: error.message
      });
    }
  });
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `logo-${Date.now()}.${fileExt}`;
  const filePath = `logos/${fileName}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('company-assets')
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteCompanyLogo(logoUrl: string): Promise<void> {
  if (!logoUrl) return;

  try {
    // Extract path from URL
    const url = new URL(logoUrl);
    const pathParts = url.pathname.split('/company-assets/');
    if (pathParts.length < 2) return;

    const filePath = pathParts[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from('company-assets')
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete old logo:', error);
  }
}
