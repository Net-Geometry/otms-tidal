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

export default function Wages() {
  return (
    <AppLayout>
      <PageLayout title="Wages Posting" description="Monthly wage posting summaries (scaffold).">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posting Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Headcount</TableHead>
                  <TableHead>Total Wages</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="opacity-60">
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>Coming soon</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Posting workflow (preview, validations, journal generation, export) will be implemented in a future phase.
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
