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
import {
  ACCOUNT_TYPE_LABELS,
  COA_ACCOUNT_SUBTYPE_LABELS,
  COA_ACCOUNT_SUBTYPE_OPTIONS,
  COA_SPECIAL_TYPE_LABELS,
  COA_SPECIAL_TYPE_OPTIONS,
  type AccountType,
  type ChartOfAccount,
  type CoaAccountSubtype,
  type CoaSpecialType,
} from '@/types/finance';

const CURRENCY_OPTIONS = ['MYR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'THB', 'IDR'];

const schema = z.object({
  account_code: z.string().min(1, 'Account code is required'),
  account_name: z.string().min(1, 'Account name is required'),
  account: z.enum(['asset', 'liability', 'equity', 'revenue', 'cost', 'expense']),
  account_type: z.enum(COA_ACCOUNT_SUBTYPE_OPTIONS),
  level: z.coerce.number().int().min(0).max(4),
  parent_id: z.string().nullable().optional(),
  is_postable: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
  system_tag: z.string().optional().nullable(),
  special_type: z.string().optional().nullable(),
  currency_code: z.string().optional().nullable(),
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
    account_subtype?: CoaAccountSubtype | null;
    level: 0 | 1 | 2 | 3 | 4;
    parent_id?: string | null;
    is_postable?: boolean;
    is_active?: boolean;
    sort_order?: number;
    system_tag?: string | null;
    special_type?: CoaSpecialType | null;
    currency_code?: string | null;
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
      account: 'asset',
      account_type: 'FA',
      level: 3,
      parent_id: null,
      is_postable: true,
      is_active: true,
      sort_order: 0,
      system_tag: '',
      special_type: '',
      currency_code: 'MYR',
      description: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!account) {
      form.reset({
        account_code: '',
        account_name: '',
        account: 'asset',
        account_type: 'FA',
        level: 3,
        parent_id: null,
        is_postable: true,
        is_active: true,
        sort_order: 0,
        system_tag: '',
        special_type: '',
        currency_code: 'MYR',
        description: '',
      });
      return;
    }

    form.reset({
      account_code: account.account_code,
      account_name: account.account_name,
      account: account.account_type,
      account_type: account.account_subtype || 'FA',
      level: account.level,
      parent_id: account.parent_id,
      is_postable: account.is_postable,
      is_active: account.is_active,
      sort_order: account.sort_order,
      system_tag: account.system_tag || '',
      special_type: account.special_type || '',
      currency_code: account.currency_code || 'MYR',
      description: account.description || '',
    });
  }, [open, account, form]);

  const watchedLevel = form.watch('level');
  const watchedAccount = form.watch('account');

  const parentOptions = useMemo(() => {
    return accounts
      .filter((row) => row.level < 4)
      .filter((row) => row.id !== account?.id)
      .filter((row) => row.account_type === watchedAccount)
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts, account?.id, watchedAccount]);

  const hasPostings = !!account?.has_postings;

  const submit = async (values: Values) => {
    await onSave({
      id: account?.id,
      account_code: values.account_code.trim(),
      account_name: values.account_name.trim(),
      account_type: values.account,
      account_subtype: values.account_type,
      level: values.level as 0 | 1 | 2 | 3 | 4,
      parent_id: values.level === 0 ? null : values.parent_id || null,
      is_postable: values.level >= 3 ? values.is_postable : false,
      is_active: values.is_active,
      sort_order: values.sort_order,
      system_tag: values.system_tag?.trim() || null,
      special_type: (values.special_type?.trim() || null) as CoaSpecialType | null,
      currency_code: values.currency_code?.trim() || null,
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
            {hasPostings && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This account has posted transactions. Account code, account, and account type cannot be changed.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="account_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1-100-100" {...field} disabled={hasPostings} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={hasPostings}>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="account_name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1">
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Salaries & Wages" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={hasPostings}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(COA_ACCOUNT_SUBTYPE_LABELS).map(([value, label]) => (
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

              <FormField
                control={form.control}
                name="currency_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value || 'MYR'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="MYR" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
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
                        <SelectItem value="0">0 - Root</SelectItem>
                        <SelectItem value="1">1 - Category</SelectItem>
                        <SelectItem value="2">2 - Group</SelectItem>
                        <SelectItem value="3">3 - Sub Group</SelectItem>
                        <SelectItem value="4">4 - Account</SelectItem>
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
                      disabled={watchedLevel === 0}
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

            <div className="grid gap-4 sm:grid-cols-3">
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

              <FormField
                control={form.control}
                name="special_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Type</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {Object.entries(COA_SPECIAL_TYPE_LABELS).map(([value, label]) => (
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
                      <p className="text-xs text-muted-foreground">Only level-3/4 accounts should be postable.</p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={watchedLevel >= 3 ? field.value : false}
                        onCheckedChange={field.onChange}
                        disabled={watchedLevel < 3}
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
