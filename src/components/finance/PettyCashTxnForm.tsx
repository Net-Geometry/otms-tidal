import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown } from 'lucide-react';
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

const schema = z.object({
  txn_type: z.enum(['top_up', 'expenditure']),
  txn_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required').max(500),
  account_id: z.string().min(1, 'Account is required'),
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
  projects: Project[];
  departments: DepartmentWithCount[];
  isSubmitting?: boolean;
}

export function PettyCashTxnForm({
  open,
  onOpenChange,
  onSubmit,
  accounts,
  projects,
  departments,
  isSubmitting,
}: PettyCashTxnFormProps) {
  const [coaOpen, setCoaOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      txn_type: 'expenditure',
      txn_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      description: '',
      account_id: '',
      project_id: null,
      receipt_urls: [],
      payee: '',
      department: '',
      tax_amount: 0,
    },
  });

  const accountOptions = useMemo(() => {
    return accounts
      .filter((row) => row.is_active)
      .filter((row) => row.is_postable)
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts]);

  const submit = async (values: Values) => {
    await onSubmit(values);
    form.reset({
      txn_type: 'expenditure',
      txn_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      description: '',
      account_id: '',
      project_id: null,
      receipt_urls: [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New Petty Cash Transaction</DialogTitle>
          <DialogDescription>Create top-up or expenditure with receipts and optional project tagging.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RM)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Amount (RM)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => {
                  const selected = accountOptions.find((a) => a.id === field.value);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Chart of Account</FormLabel>
                      <Popover open={coaOpen} onOpenChange={setCoaOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={coaOpen}
                              className={cn(
                                'w-full justify-between font-normal',
                                !field.value && 'text-muted-foreground',
                              )}
                            >
                              <span className="truncate">
                                {selected
                                  ? `${selected.account_code} - ${selected.account_name}`
                                  : 'Select account'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search account..." />
                            <CommandList>
                              <CommandEmpty>No account found.</CommandEmpty>
                              <CommandGroup>
                                {accountOptions.map((row) => (
                                  <CommandItem
                                    key={row.id}
                                    value={`${row.account_code} - ${row.account_name}`}
                                    onSelect={() => {
                                      field.onChange(row.id);
                                      setCoaOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === row.id ? 'opacity-100' : 'opacity-0',
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
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
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
                    <PettyCashReceiptUpload value={field.value || []} onChange={field.onChange} />
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
