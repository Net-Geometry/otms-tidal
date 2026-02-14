import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeaveType } from '@/types/leave';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus } from 'lucide-react';

const formSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  default_days: z.coerce.number().min(0),
  is_half_day_allowed: z.coerce.boolean().default(true),
  requires_attachment: z.coerce.boolean().default(false),
  is_paid: z.coerce.boolean().default(true),
  max_days: z.coerce.number().nullable().optional(),
  is_carry_forward: z.coerce.boolean().default(false),
  max_carry_forward: z.coerce.number().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().default(0),
  accrual_type: z.enum(['annual', 'monthly']).default('annual'),
});

type LeaveTypeFormValues = z.infer<typeof formSchema>;

export function LeaveTypeSetup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['leave-types-admin'],
    queryFn: async () => {
      const { data, error } = await db
        .from('leave_types')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as LeaveType[];
    },
    staleTime: 30 * 1000,
  });

  const defaultValues = useMemo<LeaveTypeFormValues>(() => {
    const e = editing;
    return {
      code: e?.code || '',
      name: e?.name || '',
      default_days: Number(e?.default_days || 0),
      is_half_day_allowed: e?.is_half_day_allowed ?? true,
      requires_attachment: e?.requires_attachment ?? false,
      is_paid: e?.is_paid ?? true,
      max_days: e?.max_days ?? null,
      is_carry_forward: e?.is_carry_forward ?? false,
      max_carry_forward: Number(e?.max_carry_forward || 0),
      is_active: e?.is_active ?? true,
      sort_order: Number(e?.sort_order || 0),
      accrual_type: e?.accrual_type ?? 'annual',
    };
  }, [editing]);

  const form = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: LeaveTypeFormValues) => {
      const monthlyRate = values.accrual_type === 'monthly' && values.default_days > 0
        ? Math.round((values.default_days / 12) * 100) / 100
        : null;

      if (editing) {
        const { error } = await db
          .from('leave_types')
          .update({
            name: values.name,
            default_days: values.default_days,
            is_half_day_allowed: values.is_half_day_allowed,
            requires_attachment: values.requires_attachment,
            is_paid: values.is_paid,
            max_days: values.max_days,
            is_carry_forward: values.is_carry_forward,
            max_carry_forward: values.max_carry_forward,
            is_active: values.is_active,
            sort_order: values.sort_order,
            accrual_type: values.accrual_type,
            monthly_accrual_rate: monthlyRate,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('leave_types')
          .insert([
            {
              code: values.code,
              name: values.name,
              default_days: values.default_days,
              is_half_day_allowed: values.is_half_day_allowed,
              requires_attachment: values.requires_attachment,
              is_paid: values.is_paid,
              max_days: values.max_days,
              is_carry_forward: values.is_carry_forward,
              max_carry_forward: values.max_carry_forward,
              is_active: values.is_active,
              sort_order: values.sort_order,
              accrual_type: values.accrual_type,
              monthly_accrual_rate: monthlyRate,
            },
          ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast({ title: 'Saved', description: 'Leave type updated' });
      setOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await db
        .from('leave_types')
        .update({ is_active: input.is_active })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leave Types</CardTitle>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Default</TableHead>
                  <TableHead>Accrual</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{Number(t.default_days || 0).toFixed(1)}</TableCell>
                    <TableCell className="text-xs capitalize">{t.accrual_type || 'annual'}</TableCell>
                    <TableCell>{t.requires_attachment ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!t.is_active}
                          onCheckedChange={(v) => toggleActiveMutation.mutate({ id: t.id, is_active: !!v })}
                        />
                        <span className="text-sm text-muted-foreground">{t.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditing(t);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!!editing} placeholder="annual" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Annual Leave" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="default_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Days</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          value={field.value == null ? '' : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accrual_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accrual Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select accrual type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Annual (full upfront)</SelectItem>
                          <SelectItem value="monthly">Monthly (incremental)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch('accrual_type') === 'monthly' && (
                  <div className="flex items-end">
                    <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                      Monthly rate: {((form.watch('default_days') || 0) / 12).toFixed(2)} days/month
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="requires_attachment"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Requires Attachment</div>
                          <div className="text-xs text-muted-foreground">e.g. MC image</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_half_day_allowed"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Half-Day Allowed</div>
                          <div className="text-xs text-muted-foreground">Allow 0.5 day requests</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="is_paid"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div className="text-sm font-medium">Paid</div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_carry_forward"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Carry Forward</div>
                          <div className="text-xs text-muted-foreground">Allow carry forward</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_carry_forward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Carry</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 rounded-md border p-3">
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                      <div className="text-sm font-medium">Active</div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
