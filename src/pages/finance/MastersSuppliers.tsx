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
import { useSuppliers } from '@/hooks/finance/useFinanceFoundation';
import type { Supplier } from '@/types/finance';

const schema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  supplier_code: z.string().min(1, 'Supplier code is required'),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  category: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  gst_no: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account_no: z.string().optional().nullable(),
  bank_account_holder: z.string().optional().nullable(),
  swift_code: z.string().optional().nullable(),
  payment_terms_days: z.coerce.number().min(0),
  credit_limit: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  opening_balance: z.coerce.number(),
  outstanding_balance: z.coerce.number(),
  notes: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

export default function MastersSuppliers() {
  const { data: companies = [] } = useCompanies();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const suppliers = useSuppliers({ search, includeInactive });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: '',
      supplier_code: '',
      supplier_name: '',
      category: '',
      tax_id: '',
      gst_no: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      bank_name: '',
      bank_account_no: '',
      bank_account_holder: '',
      swift_code: '',
      payment_terms_days: 30,
      credit_limit: 0,
      currency: 'MYR',
      opening_balance: 0,
      outstanding_balance: 0,
      notes: '',
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;

    if (!editingSupplier) {
      form.reset({
        company_id: companies[0]?.id || '',
        supplier_code: '',
        supplier_name: '',
        category: '',
        tax_id: '',
        gst_no: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        bank_name: '',
        bank_account_no: '',
        bank_account_holder: '',
        payment_terms_days: 30,
        credit_limit: 0,
        currency: 'MYR',
        opening_balance: 0,
        outstanding_balance: 0,
        notes: '',
      });
      return;
    }

    form.reset({
      company_id: editingSupplier.company_id,
      supplier_code: editingSupplier.supplier_code,
      supplier_name: editingSupplier.supplier_name,
      category: editingSupplier.category || '',
      tax_id: editingSupplier.tax_id || '',
      gst_no: editingSupplier.gst_no || '',
      contact_name: editingSupplier.contact_name || '',
      email: editingSupplier.email || '',
      phone: editingSupplier.phone || '',
      address: editingSupplier.address || '',
      bank_name: editingSupplier.bank_name || '',
      bank_account_no: editingSupplier.bank_account_no || '',
      bank_account_holder: editingSupplier.bank_account_holder || '',
      swift_code: editingSupplier.swift_code || '',
      payment_terms_days: Number(editingSupplier.payment_terms_days || 0),
      credit_limit: Number(editingSupplier.credit_limit || 0),
      currency: editingSupplier.currency || 'MYR',
      opening_balance: Number(editingSupplier.opening_balance || 0),
      outstanding_balance: Number(editingSupplier.outstanding_balance || 0),
      notes: editingSupplier.notes || '',
    });
  }, [dialogOpen, editingSupplier, companies, form]);

  const submit = async (values: Values) => {
    await suppliers.upsertSupplier({
      id: editingSupplier?.id,
      company_id: values.company_id,
      supplier_code: values.supplier_code.trim(),
      supplier_name: values.supplier_name.trim(),
      category: values.category?.trim() || null,
      tax_id: values.tax_id?.trim() || null,
      gst_no: values.gst_no?.trim() || null,
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      bank_name: values.bank_name?.trim() || null,
      bank_account_no: values.bank_account_no?.trim() || null,
      bank_account_holder: values.bank_account_holder?.trim() || null,
      swift_code: values.swift_code?.trim() || null,
      payment_terms_days: Number(values.payment_terms_days),
      credit_limit: Number(values.credit_limit),
      currency: values.currency.trim().toUpperCase(),
      opening_balance: Number(values.opening_balance),
      outstanding_balance: Number(values.outstanding_balance),
      is_active: editingSupplier?.is_active ?? true,
      notes: values.notes?.trim() || null,
    });

    setDialogOpen(false);
    setEditingSupplier(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Suppliers"
        description="Manage supplier master data including tax details, bank setup, and credit controls."
        actions={
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="supplier-search">Search</Label>
                <Input
                  id="supplier-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Code, name, category, tax ID, email..."
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="include-inactive-suppliers"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                />
                <Label htmlFor="include-inactive-suppliers">Include inactive</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!suppliers.suppliers.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No suppliers found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.supplier_code}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{supplier.supplier_name}</div>
                            <div className="text-xs text-muted-foreground">{supplier.category || 'Uncategorized'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{supplier.companies?.code || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div>{supplier.contact_name || '-'}</div>
                            <div className="text-muted-foreground">{supplier.email || supplier.phone || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(supplier.outstanding_balance || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                            {supplier.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingSupplier(supplier);
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {supplier.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => suppliers.archiveSupplier(supplier.id)}
                                disabled={suppliers.isArchiving}
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
            if (!open) setEditingSupplier(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
              <DialogDescription>Set supplier profile, tax setup, and commercial controls.</DialogDescription>
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
                    name="supplier_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Code</FormLabel>
                        <FormControl>
                          <Input placeholder="SUP-0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="General / Services / Utilities" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="supplier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Supplier legal name" {...field} />
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
                    name="gst_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GST No.</FormLabel>
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
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
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
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_account_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Account No.</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_account_holder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder</FormLabel>
                        <FormControl>
                          <Input value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="swift_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MABORZ2X" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                  <Button type="submit" disabled={suppliers.isSaving}>
                    {suppliers.isSaving ? 'Saving...' : 'Save Supplier'}
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
