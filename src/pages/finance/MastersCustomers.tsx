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
import { useCustomers } from '@/hooks/finance/useFinanceFoundation';
import { FINANCE_STATEMENT_FREQUENCY_LABELS, type Customer, type FinanceStatementFrequency } from '@/types/finance';

const schema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  customer_code: z.string().min(1, 'Customer code is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  tax_id: z.string().optional().nullable(),
  sst_no: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional().nullable(),
  billing_address: z.string().optional().nullable(),
  shipping_address: z.string().optional().nullable(),
  payment_terms_days: z.coerce.number().min(0),
  credit_limit: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  statement_frequency: z.enum(['monthly', 'quarterly', 'on_demand']),
  opening_balance: z.coerce.number(),
  outstanding_balance: z.coerce.number(),
  notes: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

export default function MastersCustomers() {
  const { data: companies = [] } = useCompanies();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const customers = useCustomers({ search, includeInactive });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: '',
      customer_code: '',
      customer_name: '',
      tax_id: '',
      sst_no: '',
      contact_name: '',
      email: '',
      phone: '',
      billing_address: '',
      shipping_address: '',
      payment_terms_days: 30,
      credit_limit: 0,
      currency: 'MYR',
      statement_frequency: 'monthly',
      opening_balance: 0,
      outstanding_balance: 0,
      notes: '',
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;

    if (!editingCustomer) {
      form.reset({
        company_id: companies[0]?.id || '',
        customer_code: '',
        customer_name: '',
        tax_id: '',
        sst_no: '',
        contact_name: '',
        email: '',
        phone: '',
        billing_address: '',
        shipping_address: '',
        payment_terms_days: 30,
        credit_limit: 0,
        currency: 'MYR',
        statement_frequency: 'monthly',
        opening_balance: 0,
        outstanding_balance: 0,
        notes: '',
      });
      return;
    }

    form.reset({
      company_id: editingCustomer.company_id,
      customer_code: editingCustomer.customer_code,
      customer_name: editingCustomer.customer_name,
      tax_id: editingCustomer.tax_id || '',
      sst_no: editingCustomer.sst_no || '',
      contact_name: editingCustomer.contact_name || '',
      email: editingCustomer.email || '',
      phone: editingCustomer.phone || '',
      billing_address: editingCustomer.billing_address || '',
      shipping_address: editingCustomer.shipping_address || '',
      payment_terms_days: Number(editingCustomer.payment_terms_days || 0),
      credit_limit: Number(editingCustomer.credit_limit || 0),
      currency: editingCustomer.currency || 'MYR',
      statement_frequency: editingCustomer.statement_frequency,
      opening_balance: Number(editingCustomer.opening_balance || 0),
      outstanding_balance: Number(editingCustomer.outstanding_balance || 0),
      notes: editingCustomer.notes || '',
    });
  }, [dialogOpen, editingCustomer, companies, form]);

  const submit = async (values: Values) => {
    await customers.upsertCustomer({
      id: editingCustomer?.id,
      company_id: values.company_id,
      customer_code: values.customer_code.trim(),
      customer_name: values.customer_name.trim(),
      tax_id: values.tax_id?.trim() || null,
      sst_no: values.sst_no?.trim() || null,
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      billing_address: values.billing_address?.trim() || null,
      shipping_address: values.shipping_address?.trim() || null,
      payment_terms_days: Number(values.payment_terms_days),
      credit_limit: Number(values.credit_limit),
      currency: values.currency.trim().toUpperCase(),
      statement_frequency: values.statement_frequency as FinanceStatementFrequency,
      opening_balance: Number(values.opening_balance),
      outstanding_balance: Number(values.outstanding_balance),
      is_active: editingCustomer?.is_active ?? true,
      notes: values.notes?.trim() || null,
    });

    setDialogOpen(false);
    setEditingCustomer(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Customers"
        description="Maintain customer billing profiles, SST details, credit limits, and statement cadence."
        actions={
          <Button
            onClick={() => {
              setEditingCustomer(null);
              setDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="customer-search">Search</Label>
                <Input
                  id="customer-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Code, name, tax ID, SST, email..."
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="include-inactive-customers"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                />
                <Label htmlFor="include-inactive-customers">Include inactive</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!customers.customers.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No customers found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Statement</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.customer_code}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{customer.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{customer.contact_name || customer.email || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{customer.companies?.code || '-'}</TableCell>
                        <TableCell>{FINANCE_STATEMENT_FREQUENCY_LABELS[customer.statement_frequency]}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(customer.outstanding_balance || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingCustomer(customer);
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {customer.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => customers.archiveCustomer(customer.id)}
                                disabled={customers.isArchiving}
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
            if (!open) setEditingCustomer(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
              <DialogDescription>Set customer billing profile, credit controls, and statement preferences.</DialogDescription>
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
                    name="customer_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Code</FormLabel>
                        <FormControl>
                          <Input placeholder="CUS-0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="statement_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statement Frequency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(FINANCE_STATEMENT_FREQUENCY_LABELS).map(([value, label]) => (
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

                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer legal name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sst_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SST No.</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
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
                </div>

                <FormField
                  control={form.control}
                  name="billing_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Address</FormLabel>
                      <FormControl>
                        <Input value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shipping_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Address</FormLabel>
                      <FormControl>
                        <Input value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="payment_terms_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="credit_limit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opening_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Balance</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="outstanding_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outstanding</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={customers.isSaving}>
                    {customers.isSaving ? 'Saving...' : 'Save Customer'}
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
