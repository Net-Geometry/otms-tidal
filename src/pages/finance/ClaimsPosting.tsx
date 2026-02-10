import { AppLayout } from '@/components/AppLayout';
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

export default function ClaimsPosting() {
  return (
    <AppLayout>
      <PageLayout title="Claims Posting" description="Post approved claims to projects/accounts (scaffold).">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claims Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="opacity-60">
                  <TableCell>-</TableCell>
                  <TableCell>Coming soon</TableCell>
                  <TableCell>Link to project</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>Scaffold</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Posting workflow (validation, batching, approvals, export) will be implemented in a future phase.
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
