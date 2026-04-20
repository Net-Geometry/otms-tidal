import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, RotateCcw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useProjects } from '@/hooks/finance/useProjects';
import { GLAccountCombobox } from '@/components/finance/GLAccountCombobox';
import {
  useCreateJournalEntry,
  useJournalEntries,
  useJournalEntryDetail,
  useReverseJournalEntry,
  type GLPostingLineInput,
} from '@/hooks/finance/useGeneralLedger';
import { GL_REFERENCE_TYPE_LABELS, type GLReferenceType } from '@/types/finance';

interface ManualLineFormState {
  id: string;
  account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
  cost_center: string;
  project_id: string;
}

function generateLineId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeEmptyLine(): ManualLineFormState {
  return {
    id: generateLineId(),
    account_id: '',
    description: '',
    debit_amount: '',
    credit_amount: '',
    cost_center: '',
    project_id: '',
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function JournalEntries() {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [referenceType, setReferenceType] = useState<'all' | GLReferenceType>('all');
  const [page, setPage] = useState(1);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryDescription, setEntryDescription] = useState('');
  const [lines, setLines] = useState<ManualLineFormState[]>([makeEmptyLine(), makeEmptyLine()]);

  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [reverseEntryId, setReverseEntryId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const coa = useChartOfAccounts({ accountType: 'all', activity: 'active', search: '' });
  const projects = useProjects();

  const entries = useJournalEntries({
    page,
    pageSize: 15,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    accountId: accountFilter === 'all' ? undefined : accountFilter,
    referenceType,
    search: search.trim() || undefined,
  });

  const detail = useJournalEntryDetail(detailEntryId);
  const create = useCreateJournalEntry();
  const reverse = useReverseJournalEntry();

  const postingAccounts = useMemo(
    () => coa.accounts.filter((account) => account.is_active && account.is_postable),
    [coa.accounts],
  );

  const formTotals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        acc.debit += Number(line.debit_amount || 0);
        acc.credit += Number(line.credit_amount || 0);
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [lines]);

  const resetManualForm = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryDescription('');
    setLines([makeEmptyLine(), makeEmptyLine()]);
  };

  const onAddLine = () => {
    setLines((prev) => [...prev, makeEmptyLine()]);
  };

  const onRemoveLine = (lineId: string) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((line) => line.id !== lineId);
    });
  };

  const onUpdateLine = (lineId: string, key: keyof ManualLineFormState, value: string) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)));
  };

  const submitManualJournal = async () => {
    const preparedLines: GLPostingLineInput[] = lines
      .map((line) => ({
        account_id: line.account_id,
        description: line.description.trim() || null,
        debit_amount: Number(line.debit_amount || 0),
        credit_amount: Number(line.credit_amount || 0),
        cost_center: line.cost_center.trim() || null,
        project_id: line.project_id || null,
      }))
      .filter((line) => line.account_id && (Number(line.debit_amount || 0) > 0 || Number(line.credit_amount || 0) > 0));

    if (preparedLines.length < 2) {
      toast({
        title: 'Incomplete journal',
        description: 'Add at least two valid lines with account and amount.',
        variant: 'destructive',
      });
      return;
    }

    const debit = preparedLines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0);
    const credit = preparedLines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0);

    if (Math.abs(debit - credit) > 0.0001) {
      toast({
        title: 'Unbalanced journal',
        description: 'Total debit must equal total credit before posting.',
        variant: 'destructive',
      });
      return;
    }

    await create.createJournalEntry({
      entry_date: entryDate,
      description: entryDescription.trim() || null,
      lines: preparedLines,
    });

    setManualDialogOpen(false);
    resetManualForm();
  };

  const submitReverse = async () => {
    if (!reverseEntryId) return;
    await reverse.reverseJournalEntry({
      journalEntryId: reverseEntryId,
      reason: reverseReason.trim() || undefined,
    });
    setReverseEntryId(null);
    setReverseReason('');
  };

  const rows = entries.data?.entries || [];
  const totalPages = entries.data?.totalPages || 0;

  return (
    <AppLayout>
      <PageLayout
        title="Journal Entries"
        description="Review and post General Ledger journals with full debit-credit balancing."
        actions={
          <Button
            onClick={() => {
              resetManualForm();
              setManualDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Manual JV
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-6">
              <Input
                className="md:col-span-2"
                placeholder="Search entry number or description"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />

              <Input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
                }}
              />

              <Input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
              />

              <Select
                value={referenceType}
                onValueChange={(value) => {
                  setReferenceType(value as 'all' | GLReferenceType);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Reference type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(GL_REFERENCE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={accountFilter}
                onValueChange={(value) => {
                  setAccountFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {postingAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Journal Listing</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !entries.isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No journal entries found for the selected filters.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.entry_number}</TableCell>
                        <TableCell>{format(new Date(entry.entry_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{GL_REFERENCE_TYPE_LABELS[entry.reference_type]}</TableCell>
                        <TableCell>{entry.description || '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(entry.total_debit || 0))}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(entry.total_credit || 0))}</TableCell>
                        <TableCell>
                          <Badge variant={entry.is_reversed ? 'secondary' : 'default'}>
                            {entry.is_reversed ? 'Reversed' : 'Posted'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDetailEntryId(entry.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            {!entry.is_reversed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setReverseEntryId(entry.id);
                                  setReverseReason('');
                                }}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reverse
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>New Manual Journal Voucher</DialogTitle>
              <DialogDescription>Enter balanced debit and credit lines before posting.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Entry Date</Label>
                <Input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={entryDescription}
                  onChange={(event) => setEntryDescription(event.target.value)}
                  placeholder="Optional journal description"
                />
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <Card key={line.id}>
                  <CardContent className="pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">Line {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={lines.length <= 2}
                        onClick={() => onRemoveLine(line.id)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-6">
                      <div className="md:col-span-2 space-y-2">
                        <Label>Account</Label>
                        <GLAccountCombobox
                          value={line.account_id}
                          onChange={(value) => onUpdateLine(line.id, 'account_id', value)}
                          options={postingAccounts}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Debit</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit_amount}
                          onChange={(event) => onUpdateLine(line.id, 'debit_amount', event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Credit</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit_amount}
                          onChange={(event) => onUpdateLine(line.id, 'credit_amount', event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Cost Center</Label>
                        <Input
                          value={line.cost_center}
                          onChange={(event) => onUpdateLine(line.id, 'cost_center', event.target.value)}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select
                          value={line.project_id || 'none'}
                          onValueChange={(value) => onUpdateLine(line.id, 'project_id', value === 'none' ? '' : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Project</SelectItem>
                            {projects.projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.project_code} - {project.project_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Label>Line Description</Label>
                      <Input
                        value={line.description}
                        onChange={(event) => onUpdateLine(line.id, 'description', event.target.value)}
                        placeholder="Optional line description"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={onAddLine}>
                Add Line
              </Button>

              <Card>
                <CardContent className="pt-4">
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>Total Debit: <span className="font-medium">{formatMoney(formTotals.debit)}</span></p>
                    <p>Total Credit: <span className="font-medium">{formatMoney(formTotals.credit)}</span></p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.abs(formTotals.debit - formTotals.credit) <= 0.0001
                      ? 'Journal is balanced and ready to post.'
                      : 'Journal is not balanced yet.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={submitManualJournal} disabled={create.isCreating}>
                {create.isCreating ? 'Posting...' : 'Post Journal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailEntryId} onOpenChange={(open) => !open && setDetailEntryId(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Journal Entry Detail</DialogTitle>
              <DialogDescription>Line-level view of the selected journal posting.</DialogDescription>
            </DialogHeader>

            {detail.isLoading || !detail.data ? (
              <p className="text-sm text-muted-foreground">Loading journal entry...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Entry No:</span> {detail.data.entry_number}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Date:</span> {format(new Date(detail.data.entry_date), 'dd MMM yyyy')}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reference:</span> {GL_REFERENCE_TYPE_LABELS[detail.data.reference_type]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> {detail.data.is_reversed ? 'Reversed' : 'Posted'}
                  </p>
                </div>

                {detail.data.description && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Description:</span> {detail.data.description}
                  </p>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.data.lines || []).map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            {line.account?.account_code} - {line.account?.account_name}
                          </TableCell>
                          <TableCell>{line.description || '-'}</TableCell>
                          <TableCell className="text-right">{formatMoney(Number(line.debit_amount || 0))}</TableCell>
                          <TableCell className="text-right">{formatMoney(Number(line.credit_amount || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>Total Debit: <span className="font-medium">{formatMoney(Number(detail.data.total_debit || 0))}</span></p>
                  <p>Total Credit: <span className="font-medium">{formatMoney(Number(detail.data.total_credit || 0))}</span></p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!reverseEntryId} onOpenChange={(open) => !open && setReverseEntryId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Reverse Journal Entry</DialogTitle>
              <DialogDescription>
                This creates a new contra journal and marks the original entry as reversed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                rows={4}
                value={reverseReason}
                onChange={(event) => setReverseReason(event.target.value)}
                placeholder="Reason for reversal"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReverseEntryId(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={submitReverse} disabled={reverse.isReversing}>
                {reverse.isReversing ? 'Reversing...' : 'Confirm Reversal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
