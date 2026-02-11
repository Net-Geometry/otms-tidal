import { useMemo } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { COST_CATEGORY_LABELS, type ChartOfAccount, type CostCategory, type Project } from '@/types/finance';

const schema = z.object({
  project_id: z.string().min(1, 'Project is required'),
  cost_category: z.enum(['labor', 'materials', 'subcontractor', 'equipment', 'overhead', 'travel', 'other']),
  account_id: z.string().min(1, 'Account is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  cost_date: z.string().min(1, 'Date is required'),
  description: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

interface ProjectCostAllocationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  accounts: ChartOfAccount[];
  onSubmit: (values: {
    project_id: string;
    cost_category: CostCategory;
    account_id: string;
    amount: number;
    cost_date: string;
    description?: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function ProjectCostAllocationForm({
  open,
  onOpenChange,
  projects,
  accounts,
  onSubmit,
  isSubmitting,
}: ProjectCostAllocationFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: '',
      cost_category: 'labor',
      account_id: '',
      amount: 0,
      cost_date: new Date().toISOString().slice(0, 10),
      description: '',
    },
  });

  const accountOptions = useMemo(() => {
    return accounts
      .filter((row) => row.level === 3 && row.is_postable && row.is_active)
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts]);

  const submit = async (values: Values) => {
    await onSubmit({
      project_id: values.project_id,
      cost_category: values.cost_category,
      account_id: values.account_id,
      amount: Number(values.amount),
      cost_date: values.cost_date,
      description: values.description?.trim() || null,
    });

    form.reset({
      project_id: '',
      cost_category: 'labor',
      account_id: '',
      amount: 0,
      cost_date: new Date().toISOString().slice(0, 10),
      description: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manual Cost Allocation</DialogTitle>
          <DialogDescription>Add cost entries for projects when source data is external.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.project_code} - {project.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cost_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(COST_CATEGORY_LABELS).map(([value, label]) => (
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Account</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accountOptions.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_code} - {account.account_name}
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
                name="cost_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea value={field.value || ''} onChange={field.onChange} placeholder="Notes for this allocation" />
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
                {isSubmitting ? 'Saving...' : 'Save Allocation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
