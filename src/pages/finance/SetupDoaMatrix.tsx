import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useDoaRules } from '@/hooks/finance/useFinanceFoundation';
import { FINANCE_DOA_DOCUMENT_LABELS, type DoaRule, type FinanceDoaDocumentType } from '@/types/finance';

const approverRoles = [
  'supervisor', 'hr', 'management',
  'finance', 'finance_admin', 'account_assistant',
  'assistant_manager', 'manager', 'dmd', 'account_exec', 'sgm',
  'admin',
] as const;

const schema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  document_type: z.enum(['prf', 'pv', 'ap_invoice', 'ar_invoice', 'journal', 'pcv']),
  approval_level: z.coerce.number().min(1).max(4),
  min_amount: z.coerce.number().min(0),
  max_amount: z.union([z.coerce.number().min(0), z.nan()]).optional(),
  approver_role: z.enum(approverRoles),
  is_active: z.boolean().default(true),
  remarks: z.string().optional().nullable(),
}).superRefine((values, ctx) => {
  if (typeof values.max_amount === 'number' && !Number.isNaN(values.max_amount) && values.max_amount < values.min_amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Max amount must be greater than or equal to min amount',
      path: ['max_amount'],
    });
  }
});

type Values = z.infer<typeof schema>;

function formatRange(minAmount: number, maxAmount: number | null) {
  if (maxAmount == null) return `${formatCurrency(minAmount)} and above`;
  return `${formatCurrency(minAmount)} - ${formatCurrency(maxAmount)}`;
}

export default function SetupDoaMatrix() {
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [documentFilter, setDocumentFilter] = useState<FinanceDoaDocumentType | 'all'>('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DoaRule | null>(null);

  const rules = useDoaRules({
    companyId: selectedCompanyId || undefined,
    documentType: documentFilter,
    includeInactive,
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: '',
      document_type: 'prf',
      approval_level: 1,
      min_amount: 0,
      max_amount: Number.NaN,
      approver_role: 'management',
      is_active: true,
      remarks: '',
    },
  });

  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [selectedCompanyId, companies]);

  useEffect(() => {
    if (!dialogOpen) return;

    if (!editingRule) {
      form.reset({
        company_id: selectedCompanyId,
        document_type: 'prf',
        approval_level: 1,
        min_amount: 0,
        max_amount: Number.NaN,
        approver_role: 'management',
        is_active: true,
        remarks: '',
      });
      return;
    }

    form.reset({
      company_id: editingRule.company_id,
      document_type: editingRule.document_type,
      approval_level: editingRule.approval_level,
      min_amount: Number(editingRule.min_amount || 0),
      max_amount: editingRule.max_amount == null ? Number.NaN : Number(editingRule.max_amount),
      approver_role: editingRule.approver_role as Values['approver_role'],
      is_active: editingRule.is_active,
      remarks: editingRule.remarks || '',
    });
  }, [dialogOpen, editingRule, selectedCompanyId, form]);

  const sortedRules = useMemo(() => {
    return [...rules.rules].sort((a, b) => {
      if (a.document_type !== b.document_type) return a.document_type.localeCompare(b.document_type);
      if (a.approval_level !== b.approval_level) return a.approval_level - b.approval_level;
      return Number(a.min_amount || 0) - Number(b.min_amount || 0);
    });
  }, [rules.rules]);

  const submit = async (values: Values) => {
    await rules.upsertRule({
      id: editingRule?.id,
      company_id: values.company_id,
      document_type: values.document_type,
      approval_level: Number(values.approval_level) as 1 | 2 | 3 | 4,
      min_amount: Number(values.min_amount || 0),
      max_amount: typeof values.max_amount === 'number' && !Number.isNaN(values.max_amount)
        ? Number(values.max_amount)
        : null,
      approver_role: values.approver_role,
      is_active: values.is_active,
      remarks: values.remarks?.trim() || null,
    });

    setDialogOpen(false);
    setEditingRule(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="DOA Matrix"
        description="Configure amount-based approval tiers by document type, up to four levels per workflow."
        actions={
          <Button
            onClick={() => {
              setEditingRule(null);
              setDialogOpen(true);
            }}
            disabled={!selectedCompanyId}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Company</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentFilter} onValueChange={(value) => setDocumentFilter(value as FinanceDoaDocumentType | 'all')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    {Object.entries(FINANCE_DOA_DOCUMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="include-inactive-rules"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                />
                <Label htmlFor="include-inactive-rules">Include inactive</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {!sortedRules.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No DOA rules found for the selected filters.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Amount Window</TableHead>
                      <TableHead>Approver Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{FINANCE_DOA_DOCUMENT_LABELS[rule.document_type]}</TableCell>
                        <TableCell>Level {rule.approval_level}</TableCell>
                        <TableCell>{formatRange(Number(rule.min_amount || 0), rule.max_amount == null ? null : Number(rule.max_amount))}</TableCell>
                        <TableCell className="uppercase">{rule.approver_role}</TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingRule(rule);
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {rule.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => rules.archiveRule(rule.id)}
                                disabled={rules.isArchiving}
                              >
                                Archive
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
          </CardContent>
        </Card>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingRule(null);
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit DOA Rule' : 'New DOA Rule'}</DialogTitle>
              <DialogDescription>Set approval level, amount range, and responsible role.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
                <div className="grid gap-4 sm:grid-cols-2">
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
                    name="document_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(FINANCE_DOA_DOCUMENT_LABELS).map(([value, label]) => (
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

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="approval_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Level</FormLabel>
                        <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                            <SelectItem value="4">Level 4</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="min_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Amount</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Amount (blank = no cap)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={typeof field.value === 'number' && !Number.isNaN(field.value) ? field.value : ''}
                            onChange={(event) => {
                              if (!event.target.value) {
                                field.onChange(Number.NaN);
                                return;
                              }
                              field.onChange(Number(event.target.value));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="approver_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approver Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approverRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.toUpperCase()}
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
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional rule notes" value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={rules.isSaving}>
                    {rules.isSaving ? 'Saving...' : 'Save Rule'}
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
