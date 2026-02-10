import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wallet } from 'lucide-react';

export default function PettyCash() {
  return (
    <AppLayout>
      <PageLayout title="Petty Cash" description="Balance and petty cash transactions (scaffold).">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <DashboardCard title="Wallet Balance" value="-" subtitle="Coming soon" icon={Wallet} />
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="opacity-60">
                      <TableCell>-</TableCell>
                      <TableCell>Coming soon</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This page will include top-ups, spending limits, approvals, and exports.
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
