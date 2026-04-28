import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { formatCurrency } from '@/lib/otCalculations';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useBankAccounts } from '@/hooks/finance/useFinanceFoundation';
import { GLAccountCombobox } from '@/components/finance/GLAccountCombobox';
import { FINANCE_BANK_ACCOUNT_TYPE_LABELS, type BankAccount, type FinanceBankAccountType } from '@/types/finance';

const schema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  account_code: z.string().min(1, 'Account code is required'),
  account_name: z.string().min(1, 'Account name is required'),
  bank_name: z.string().min(1, 'Bank name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  account_type: z.enum(['current', 'savings', 'fixed_deposit']),
  currency: z.string().min(3).max(3),
  current_balance: z.coerce.number(),
  gl_account_id: z.string().optional().nullable(),
  last_reconciled_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_reconciling: z.boolean().default(true),
});

type Values = z.infer<typeof schema>;

function toLocalDateTimeInput(dateTime: string | null) {
  if (!dateTime) return '';
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export default function MastersBankAccounts() {
  const { data: companies = [] } = useCompanies();
  const coa = useChartOfAccounts({ accountType: 'asset', activity: 'active', search: '' });
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const bankAccounts = useBankAccounts({ search, includeInactive });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: '',
      account_code: '',
      account_name: '',
      bank_name: '',
      account_number: '',
      account_type: 'current',
      currency: 'MYR',
      current_balance: 0,
      gl_account_id: '',
      last_reconciled_at: '',
      notes: '',
      is_reconciling: true,
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;

    if (!editingAccount) {
      form.reset({
        company_id: companies[0]?.id || '',
        account_code: '',
        account_name: '',
        bank_name: '',
        account_number: '',
        account_type: 'current',
        currency: 'MYR',
        current_balance: 0,
        gl_account_id: '',
        last_reconciled_at: '',
        notes: '',
        is_reconciling: true,
      });
      return;
    }

    form.reset({
      company_id: editingAccount.company_id,
      account_code: editingAccount.account_code,
      account_name: editingAccount.account_name,
      bank_name: editingAccount.bank_name,
      account_number: editingAccount.account_number,
      account_type: editingAccount.account_type,
      currency: editingAccount.currency || 'MYR',
      current_balance: Number(editingAccount.current_balance || 0),
      gl_account_id: editingAccount.gl_account_id || '',
      last_reconciled_at: toLocalDateTimeInput(editingAccount.last_reconciled_at),
      notes: editingAccount.notes || '',
      is_reconciling: editingAccount.is_reconciling,
    });
  }, [dialogOpen, editingAccount, companies, form]);

  const submit = async (values: Values) => {
    await bankAccounts.upsertBankAccount({
      id: editingAccount?.id,
      company_id: values.company_id,
      account_code: values.account_code.trim(),
      account_name: values.account_name.trim(),
      bank_name: values.bank_name.trim(),
      account_number: values.account_number.trim(),
      account_type: values.account_type as FinanceBankAccountType,
      currency: values.currency.trim().toUpperCase(),
      current_balance: Number(values.current_balance),
      gl_account_id: values.gl_account_id?.trim() || null,
      last_reconciled_at: values.last_reconciled_at ? new Date(values.last_reconciled_at).toISOString() : null,
      is_reconciling: values.is_reconciling,
      is_active: editingAccount?.is_active ?? true,
      notes: values.notes?.trim() || null,
    });

    setDialogOpen(false);
    setEditingAccount(null);
  };

  const postableAssetAccounts = coa.accounts.filter((account) => account.is_postable && account.is_active && account.account_type === 'asset');

  return (
    <AppLayout>
      <PageLayout
        title="Bank Accounts"
        description="Register operational bank accounts and link each account to the corresponding GL ledger account."
        actions={
          <Button
            onClick={() => {
              setEditingAccount(null);
              setDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Bank Account
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-6">
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="bank-account-search">Search</Label>
                <Input
                  id="bank-account-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Code, account name, bank, number, currency..."
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1 md:col-span-2">
                <Checkbox
                  id="include-inactive-bank-accounts"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                />
                <Label htmlFor="include-inactive-bank-accounts">Include inactive</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank Account Register</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const filtered = companyFilter === 'all'
                ? bankAccounts.bankAccounts
                : bankAccounts.bankAccounts.filter((ba) => ba.company_id === companyFilter);

              return !filtered.length ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No bank accounts found.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>GL Link</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((bankAccount) => (
                        <TableRow key={bankAccount.id}>
                          <TableCell className="font-medium">{bankAccount.account_code}</TableCell>
                          <TableCell className="text-xs">{(bankAccount as any).companies?.name || '-'}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{bankAccount.account_name}</div>
                              <div className="text-xs text-muted-foreground">{bankAccount.account_number}</div>
                            </div>
                          </TableCell>
                          <TableCell>{bankAccount.bank_name}</TableCell>
                          <TableCell>{FINANCE_BANK_ACCOUNT_TYPE_LABELS[bankAccount.account_type]}</TableCell>
                          <TableCell>
                            {bankAccount.gl_account ? `${bankAccount.gl_account.account_code} - ${bankAccount.gl_account.account_name}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(bankAccount.current_balance || 0))}</TableCell>
                          <TableCell>
                            <Badge variant={bankAccount.is_active ? 'default' : 'secondary'}>
                              {bankAccount.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingAccount(bankAccount);
                                  setDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              {bankAccount.is_active ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => bankAccounts.archiveBankAccount(bankAccount.id)}
                                  disabled={bankAccounts.isArchiving}
                                >
                                  Archive
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => bankAccounts.activateBankAccount(bankAccount.id)}
                                  disabled={bankAccounts.isActivating}
                                >
                                  Activate
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
            })()}
          </CardContent>
        </Card>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingAccount(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit Bank Account' : 'New Bank Account'}</DialogTitle>
              <DialogDescription>Define account profile, reconciliation control, and GL linkage.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="company_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Code</FormLabel>
                        <FormControl>
                          <Input placeholder="BANK-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(FINANCE_BANK_ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="account_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Main Operating Account" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Maybank" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input maxLength={3} value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="current_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Balance</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="gl_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked GL Account</FormLabel>
                        <FormControl>
                          <GLAccountCombobox
                            value={field.value}
                            onChange={field.onChange}
                            options={postableAssetAccounts}
                            placeholder="Select GL account"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_reconciled_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Reconciled</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_reconciling"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      </FormControl>
                      <FormLabel className="m-0">Enable reconciliation tracking</FormLabel>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={bankAccounts.isSaving}>
                    {bankAccounts.isSaving ? 'Saving...' : 'Save Bank Account'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
