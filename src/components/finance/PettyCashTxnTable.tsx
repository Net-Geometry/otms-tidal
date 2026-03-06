import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PettyCashStatus, PettyCashTransaction } from '@/types/finance';
import { PETTY_CASH_STATUS_LABELS, PETTY_CASH_TXN_TYPE_LABELS } from '@/types/finance';
import { formatCurrency } from '@/lib/otCalculations';
import { StatusWithMetadata, getPettyCashApproverMetadata } from '@/components/StatusWithMetadata';

function statusVariant(status: PettyCashStatus) {
  if (status === 'approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

interface PettyCashTxnTableProps {
  transactions: PettyCashTransaction[];
  isLoading?: boolean;
  onPost: (txnId: string) => Promise<void>;
  isPosting?: boolean;
}

export function PettyCashTxnTable({
  transactions,
  isLoading,
  onPost,
  isPosting,
}: PettyCashTxnTableProps) {
  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading transactions...</div>;
  }

  if (!transactions.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No petty cash transactions found.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Txn #</TableHead>
            <TableHead>Fund</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount (RM)</TableHead>
            <TableHead className="text-right">Balance (RM)</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="font-medium">{txn.txn_number}</TableCell>
              <TableCell>{txn.fund_account ? `${txn.fund_account.account_name}` : '-'}</TableCell>
              <TableCell>{txn.txn_date ? format(new Date(txn.txn_date), 'dd MMM yyyy') : '-'}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="max-w-[280px] truncate">{txn.description}</div>
                  {txn.payee && (
                    <div className="text-xs text-muted-foreground">Payee: {txn.payee}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {txn.project ? `${txn.project.project_code} - ${txn.project.project_name}` : 'No project'}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{PETTY_CASH_TXN_TYPE_LABELS[txn.txn_type]}</Badge>
              </TableCell>
              <TableCell>{txn.account ? `${txn.account.account_code} - ${txn.account.account_name}` : '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusWithMetadata
                    status={txn.status}
                    label={PETTY_CASH_STATUS_LABELS[txn.status]}
                    metadata={getPettyCashApproverMetadata(txn)}
                  />
                  {txn.is_posted && <Badge variant="secondary">Posted</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                <span className={txn.txn_type === 'top_up' ? 'text-green-600' : 'text-foreground'}>
                  {txn.txn_type === 'top_up' ? '+' : '-'}{Number(txn.amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </span>
              </TableCell>
              <TableCell className="text-right">{Number(txn.running_balance || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {txn.status === 'approved' && !txn.is_posted && (
                    <Button size="sm" variant="outline" onClick={() => onPost(txn.id)} disabled={isPosting}>
                      {isPosting ? 'Posting...' : 'Post'}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
