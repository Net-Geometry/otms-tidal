import { useEffect } from 'react';
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
import { useCompanies } from '@/hooks/hr/useCompanies';
import type { Project, ProjectStatus } from '@/types/finance';

const schema = z.object({
  project_code: z.string().min(1, 'Project code is required'),
  project_name: z.string().min(1, 'Project name is required'),
  company_id: z.string().min(1, 'Company is required'),
  client_name: z.string().optional().nullable(),
  budget_amount: z.coerce.number().min(0, 'Budget cannot be negative'),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type Values = z.infer<typeof schema>;

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSave: (values: {
    id?: string;
    project_code: string;
    project_name: string;
    company_id: string;
    client_name?: string | null;
    budget_amount: number;
    start_date?: string | null;
    end_date?: string | null;
    status: ProjectStatus;
    description?: string | null;
    is_active?: boolean;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function ProjectForm({ open, onOpenChange, project, onSave, isSaving }: ProjectFormProps) {
  const { data: companies = [] } = useCompanies();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_code: '',
      project_name: '',
      company_id: '',
      client_name: '',
      budget_amount: 0,
      start_date: null,
      end_date: null,
      status: 'active',
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!project) {
      form.reset({
        project_code: '',
        project_name: '',
        company_id: companies[0]?.id || '',
        client_name: '',
        budget_amount: 0,
        start_date: null,
        end_date: null,
        status: 'active',
        description: '',
        is_active: true,
      });
      return;
    }

    form.reset({
      project_code: project.project_code,
      project_name: project.project_name,
      company_id: project.company_id,
      client_name: project.client_name || '',
      budget_amount: Number(project.budget_amount || 0),
      start_date: project.start_date,
      end_date: project.end_date,
      status: project.status,
      description: project.description || '',
      is_active: project.is_active,
    });
  }, [open, project, companies, form]);

  const submit = async (values: Values) => {
    await onSave({
      id: project?.id,
      project_code: values.project_code.trim(),
      project_name: values.project_name.trim(),
      company_id: values.company_id,
      client_name: values.client_name?.trim() || null,
      budget_amount: Number(values.budget_amount || 0),
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      status: values.status,
      description: values.description?.trim() || null,
      is_active: values.is_active,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
          <DialogDescription>Track budget, project lifecycle status, and cost allocations.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="project_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PRJ-2026-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Project title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input placeholder="Client name" value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="budget_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (RM)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value || ''} onChange={field.onChange} />
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
                    <Textarea placeholder="Project notes" value={field.value || ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!isSaving}>
                {isSaving ? 'Saving...' : 'Save Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
