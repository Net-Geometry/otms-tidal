import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { PettyCashReceiptUpload } from '@/components/finance/PettyCashReceiptUpload';
import type { ChartOfAccount, Project } from '@/types/finance';
import type { DepartmentWithCount } from '@/hooks/hr/useDepartments';

const lineSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  description: z.string().default(''),
  amount: z.coerce.number().min(0, 'Amount must be >= 0'),
});

const schema = z.object({
  txn_type: z.enum(['top_up', 'expenditure']),
  txn_date: z.string().min(1, 'Date is required'),
  fund_account_id: z.string().min(1, 'Fund account is required'),
  description: z.string().min(1, 'Description is required').max(500),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
  project_id: z.string().optional().nullable(),
  receipt_urls: z.array(z.string().url()).default([]),
  payee: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  tax_amount: z.coerce.number().min(0).default(0),
});

type Values = z.infer<typeof schema>;

interface PettyCashTxnFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Values) => Promise<void>;
  accounts: ChartOfAccount[];
  fundAccounts: ChartOfAccount[];
  projects: Project[];
  departments: DepartmentWithCount[];
  isSubmitting?: boolean;
}

function LineAccountCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ChartOfAccount[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal h-8 text-xs',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {selected ? `${selected.account_code} - ${selected.account_name}` : 'Select account'}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search account..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {options.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`${row.account_code} - ${row.account_name}`}
                  onSelect={() => {
                    onChange(row.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === row.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {row.account_code} - {row.account_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PettyCashTxnForm({
  open,
  onOpenChange,
  onSubmit,
  accounts,
  fundAccounts,
  projects,
  departments,
  isSubmitting,
}: PettyCashTxnFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      txn_type: 'expenditure',
      txn_date: new Date().toISOString().slice(0, 10),
      fund_account_id: '',
      description: '',
      lines: [{ account_id: '', description: '', amount: 0 }],
      project_id: null,
      receipt_urls: [],
      payee: '',
      department: '',
      tax_amount: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const accountOptions = useMemo(() => {
    return accounts
      .filter((row) => row.is_active)
      .filter((row) => row.is_postable)
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts]);

  const watchedLines = form.watch('lines');
  const linesTotal = (watchedLines || []).reduce(
    (sum, l) => sum + Number(l.amount || 0),
    0,
  );

  const submit = async (values: Values) => {
    await onSubmit(values);
    form.reset({
      txn_type: 'expenditure',
      txn_date: new Date().toISOString().slice(0, 10),
      fund_account_id: '',
      description: '',
      lines: [{ account_id: '', description: '', amount: 0 }],
      project_id: null,
      receipt_urls: [],
      payee: '',
      department: '',
      tax_amount: 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Petty Cash Transaction</DialogTitle>
          <DialogDescription>Create top-up or expenditure with line items, receipts, and optional project tagging.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="txn_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="top_up">Top-up</SelectItem>
                        <SelectItem value="expenditure">Expenditure</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="txn_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fund_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Petty Cash Fund</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fund" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fundAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} - {a.account_name}
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
                name="payee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payee</FormLabel>
                    <FormControl>
                      <Input placeholder="Who was paid" value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? null : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No department</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
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
              name="tax_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Amount (RM)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" className="w-40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Line Items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ account_id: '', description: '', amount: 0 })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line
                </Button>
              </div>

              {form.formState.errors.lines?.message && (
                <p className="text-sm text-destructive">{form.formState.errors.lines.message}</p>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[120px] text-right">Amount (RM)</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="p-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.account_id`}
                            render={({ field: f }) => (
                              <FormItem className="space-y-0">
                                <LineAccountCombobox
                                  value={f.value}
                                  onChange={f.onChange}
                                  options={accountOptions}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.description`}
                            render={({ field: f }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input className="h-8 text-xs" placeholder="Line description" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.amount`}
                            render={({ field: f }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            disabled={fields.length <= 1}
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="text-right font-medium">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {linesTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (optional)</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? null : value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.project_code} - {row.project_name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="What was this for?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receipt_urls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipts</FormLabel>
                  <FormControl>
                    <PettyCashReceiptUpload value={field.value || []} onChange={field.onChange} maxFiles={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
