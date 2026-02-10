import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COA_SECTIONS = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'] as const;

export default function ChartOfAccounts() {
  return (
    <AppLayout>
      <PageLayout title="Chart of Accounts" description="Account structure and mapping (scaffold).">
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COA_SECTIONS.map((section) => (
                  <TableRow key={section} className="opacity-60">
                    <TableCell className="font-medium">{section}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>Coming soon</TableCell>
                    <TableCell>Scaffold</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This page is a placeholder for COA maintenance (create/edit/import, hierarchy, posting rules).
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
