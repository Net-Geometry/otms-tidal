import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
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
      <PageLayout
        title="Submit Overtime Request"
        description="Fill in the details below to submit your overtime request. All fields are required."
        onBack={() => navigate('/dashboard')}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="bg-card border border-border rounded-xl shadow-lg dark:shadow-md transition-shadow duration-300">
            <CardContent className="px-6 py-6">
              <OTForm
                onSubmit={handleSubmit}
                isSubmitting={isPending}
                employeeId={profile?.employee_id || ''}
                fullName={profile?.full_name || ''}
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>

          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 transition-colors duration-300">
            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              Please ensure all information is accurate before submitting your overtime request.
            </p>
          </div>
        </div>
      </PageLayout>
    </AppLayout>
  );
}
