import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/AppLayout';
import { ContentLoadingSkeleton } from '@/components/ContentLoadingSkeleton';
import { OTForm } from '@/components/ot/OTForm';
import { useOTSubmit } from '@/hooks/useOTSubmit';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function SubmitOT() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: submitOT, isPending } = useOTSubmit();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('employee_id, full_name')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const handleSubmit = (data: any) => {
    submitOT(data, {
      onSuccess: () => {
        navigate('/ot/history');
      },
    });
  };

  if (profileLoading) {
    return (
      <AppLayout>
        <ContentLoadingSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto mt-6 space-y-6">
        <Card className="p-6 shadow-sm border rounded-xl bg-white">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Submit Overtime Request
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Fill in the details below to submit your overtime request.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <OTForm 
              onSubmit={handleSubmit} 
              isSubmitting={isPending}
              employeeId={profile?.employee_id || ''}
              fullName={profile?.full_name || ''}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
