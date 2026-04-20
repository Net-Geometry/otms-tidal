import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bell, BellOff, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useEmployees } from '@/hooks/hr/useEmployees';
import {
  usePaymentReminders,
  useUpsertPaymentReminder,
  useTogglePaymentReminder,
  useDeletePaymentReminder,
  type PaymentReminder,
  type ReminderFrequency,
  type ReminderType,
} from '@/hooks/finance/usePaymentReminders';

interface FormState {
  id?: string;
  company_id: string;
  name: string;
  description: string;
  amount: string;
  frequency: ReminderFrequency;
  anchor_date: string;
  lead_days: string;
  reminder_type: ReminderType;
  assignee_id: string;
}

function emptyForm(companyId: string): FormState {
  return {
    company_id: companyId,
    name: '',
    description: '',
    amount: '',
    frequency: 'monthly',
    anchor_date: new Date().toISOString().slice(0, 10),
    lead_days: '3',
    reminder_type: 'create_pv',
    assignee_id: '',
  };
}

const FREQUENCY_LABEL: Record<ReminderFrequency, string> = {
  one_off: 'One-off',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const TYPE_LABEL: Record<ReminderType, string> = {
  create_prf: 'Create PRF',
  create_pv: 'Create PV',
  general: 'General',
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export default function PaymentReminders() {
  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployees();
  const [companyFilter, setCompanyFilter] = useState('all');
  const [includeInactive, setIncludeInactive] = useState(false);

  const reminders = usePaymentReminders({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    activeOnly: !includeInactive,
  });
  const upsert = useUpsertPaymentReminder();
  const toggle = useTogglePaymentReminder();
  const remove = useDeletePaymentReminder();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (companies.length && !form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const employeeOptions = useMemo(
    () => (employees as any[]).filter((e) => e.status === 'active').map((e) => ({
      id: e.id,
      label: `${e.full_name} (${e.employee_id})`,
    })),
    [employees],
  );

  const openNew = () => {
    setForm(emptyForm(companyFilter === 'all' ? companies[0]?.id || '' : companyFilter));
    setDialogOpen(true);
  };

  const openEdit = (r: PaymentReminder) => {
    setForm({
      id: r.id,
      company_id: r.company_id,
      name: r.name,
      description: r.description || '',
      amount: r.amount != null ? String(r.amount) : '',
      frequency: r.frequency,
      anchor_date: r.anchor_date,
      lead_days: String(r.lead_days),
      reminder_type: r.reminder_type,
      assignee_id: r.assignee_id,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.assignee_id || !form.company_id) return;
    await upsert.mutateAsync({
      id: form.id,
      company_id: form.company_id,
      name: form.name,
      description: form.description,
      amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency,
      anchor_date: form.anchor_date,
      lead_days: Math.max(0, Math.min(90, Number(form.lead_days || 0))),
      reminder_type: form.reminder_type,
      assignee_id: form.assignee_id,
    });
    setDialogOpen(false);
  };

  const rows = reminders.data || [];

  return (
    <AppLayout>
      <PageLayout
        title="Payment Reminders"
        description="Schedule reminders for upcoming PRF/PV creation and recurring payments."
        actions={
          <Button onClick={openNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Reminder
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-inactive-reminders"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                />
                <Label htmlFor="include-inactive-reminders" className="cursor-pointer text-sm font-normal">
                  Include paused / completed
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reminder Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !reminders.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No reminders. Click "New Reminder" to create one.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Notify Lead</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className={!r.is_active ? 'opacity-60' : undefined}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          {r.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{TYPE_LABEL[r.reminder_type]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{FREQUENCY_LABEL[r.frequency]}</TableCell>
                        <TableCell className="text-sm">{format(new Date(r.anchor_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.lead_days}d before</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                        <TableCell className="text-sm">{r.assignee?.full_name || '—'}</TableCell>
                        <TableCell>
                          {r.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Paused</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggle.mutate({ id: r.id, is_active: !r.is_active })}
                              title={r.is_active ? 'Pause' : 'Activate'}
                            >
                              {r.is_active ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDeleteId(r.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Edit Reminder' : 'New Payment Reminder'}</DialogTitle>
              <DialogDescription>
                Schedule a notification before a PRF/PV needs to be created.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Wifi bill — TM Unifi"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Context that helps the assignee, e.g. account number, vendor, what to attach"
                />
              </div>

              <div className="space-y-2">
                <Label>Company *</Label>
                <Select
                  value={form.company_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, company_id: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reminder Type</Label>
                <Select
                  value={form.reminder_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, reminder_type: v as ReminderType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_prf">Create PRF</SelectItem>
                    <SelectItem value="create_pv">Create PV</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm((p) => ({ ...p, frequency: v as ReminderFrequency }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One-off (single reminder)</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{form.frequency === 'one_off' ? 'Due Date' : 'Next Occurrence'} *</Label>
                <Input
                  type="date"
                  value={form.anchor_date}
                  onChange={(e) => setForm((p) => ({ ...p, anchor_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Lead Time (days before)</Label>
                <Input
                  type="number"
                  min="0"
                  max="90"
                  value={form.lead_days}
                  onChange={(e) => setForm((p) => ({ ...p, lead_days: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Notify {form.lead_days || '0'} days before the due date.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Amount (RM)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notify *</Label>
                <Select
                  value={form.assignee_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, assignee_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick the person to notify" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={save}
                disabled={upsert.isPending || !form.name.trim() || !form.assignee_id || !form.company_id}
              >
                {upsert.isPending ? 'Saving…' : 'Save Reminder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete reminder?</DialogTitle>
              <DialogDescription>
                This permanently removes the reminder and its schedule. To pause instead, use the bell icon.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (confirmDeleteId) await remove.mutateAsync(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
