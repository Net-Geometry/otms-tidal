import { useNavigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card, CardContent } from '@/components/ui/card';

export default function ApproveApPayment() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <PageLayout
        title="Approve AP Payment"
        description="AP Payment approval"
        onBack={() => navigate('/management/dashboard')}
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Coming Soon</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              AP Payments no longer require a separate approval workflow.
              Payment approvals are handled through the Payment Voucher approval process.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
