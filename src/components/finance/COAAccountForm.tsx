import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ACCOUNT_TYPE_LABELS, type AccountType, type ChartOfAccount } from '@/types/finance';

const schema = z.object({
  account_code: z.string().min(1, 'Account code is required'),
  account_name: z.string().min(1, 'Account name is required'),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  level: z.coerce.number().int().min(1).max(3),
  parent_id: z.string().nullable().optional(),
  is_postable: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
  system_tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

interface COAAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: ChartOfAccount | null;
  accounts: ChartOfAccount[];
  onSave: (values: {
    id?: string;
    account_code: string;
    account_name: string;
    account_type: AccountType;
    level: 1 | 2 | 3;
    parent_id?: string | null;
    is_postable?: boolean;
    is_active?: boolean;
    sort_order?: number;
    system_tag?: string | null;
    description?: string | null;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function COAAccountForm({ open, onOpenChange, account, accounts, onSave, isSaving }: COAAccountFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_code: '',
      account_name: '',
      account_type: 'asset',
      level: 3,
      parent_id: null,
      is_postable: true,
      is_active: true,
      sort_order: 0,
      system_tag: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!account) {
      form.reset({
        account_code: '',
        account_name: '',
        account_type: 'asset',
        level: 3,
        parent_id: null,
        is_postable: true,
        is_active: true,
        sort_order: 0,
        system_tag: '',
        description: '',
      });
      return;
    }

    form.reset({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      level: account.level,
      parent_id: account.parent_id,
      is_postable: account.is_postable,
      is_active: account.is_active,
      sort_order: account.sort_order,
      system_tag: account.system_tag || '',
      description: account.description || '',
    });
  }, [open, account, form]);

  const watchedLevel = form.watch('level');
  const watchedType = form.watch('account_type');

  const parentOptions = useMemo(() => {
    return accounts
      .filter((row) => row.level < 3)
      .filter((row) => row.id !== account?.id)
      .filter((row) => row.account_type === watchedType)
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts, account?.id, watchedType]);

  const submit = async (values: Values) => {
    await onSave({
      id: account?.id,
      account_code: values.account_code.trim(),
      account_name: values.account_name.trim(),
      account_type: values.account_type,
      level: values.level as 1 | 2 | 3,
      parent_id: values.level === 1 ? null : values.parent_id || null,
      is_postable: values.level === 3 ? values.is_postable : false,
      is_active: values.is_active,
      sort_order: values.sort_order,
      system_tag: values.system_tag?.trim() || null,
      description: values.description?.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription>
            Maintain the account hierarchy and posting behavior for finance modules.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="account_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 5110" {...field} />
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
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
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
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Salaries & Wages" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 - Category</SelectItem>
                        <SelectItem value="2">2 - Group</SelectItem>
                        <SelectItem value="3">3 - Account</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Parent Account</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      disabled={watchedLevel === 1}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Parent</SelectItem>
                        {parentOptions.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.account_code} - {row.account_name}
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
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="system_tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Tag</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. payroll_gross" value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional notes" value={field.value || ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="is_postable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Postable Account</FormLabel>
                      <p className="text-xs text-muted-foreground">Only level-3 accounts should be postable.</p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={watchedLevel === 3 ? field.value : false}
                        onCheckedChange={field.onChange}
                        disabled={watchedLevel !== 3}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <p className="text-xs text-muted-foreground">Inactive accounts stay in history but are hidden by default.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!isSaving}>
                {isSaving ? 'Saving...' : 'Save Account'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
