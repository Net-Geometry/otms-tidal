import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ClaimType, ClaimFinalApprover } from '@/types/claims';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Pencil, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  final_approver: z.enum(['hr', 'finance']),
  limit_amount: z.coerce.number().nullable().optional(),
  limit_period: z.string().max(30).nullable().optional(),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().default(0),
});

type ClaimTypeFormValues = z.infer<typeof formSchema>;

export function ClaimTypeSetup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClaimType | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['claim-types-admin'],
    queryFn: async () => {
      const { data, error } = await db
        .from('claim_types')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as ClaimType[];
    },
    staleTime: 30 * 1000,
  });

  const defaultValues = useMemo<ClaimTypeFormValues>(() => {
    const e = editing;
    return {
      code: e?.code || '',
      name: e?.name || '',
      final_approver: (e?.final_approver || 'hr') as ClaimFinalApprover,
      limit_amount: e?.limit_amount ?? null,
      limit_period: e?.limit_period ?? null,
      is_active: e?.is_active ?? true,
      sort_order: Number(e?.sort_order || 0),
    };
  }, [editing]);

  const form = useForm<ClaimTypeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: ClaimTypeFormValues) => {
      const payload = {
        name: values.name,
        final_approver: values.final_approver,
        limit_amount: values.limit_amount == null ? null : Number(values.limit_amount),
        limit_period: values.limit_period || null,
        is_active: values.is_active,
        sort_order: values.sort_order,
      };

      if (editing) {
        const { error } = await db.from('claim_types').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('claim_types')
          .insert([
            {
              code: values.code,
              ...payload,
            },
          ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['claim-types'] });
      toast({ title: 'Saved', description: 'Claim type updated' });
      setOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await db.from('claim_types').update({ is_active: input.is_active }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['claim-types'] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Claim Types</CardTitle>
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
                  <TableHead>Final</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="capitalize">{t.final_approver}</TableCell>
                    <TableCell>
                      {t.limit_amount == null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <span>
                          RM{Number(t.limit_amount).toFixed(2)}{t.limit_period ? `/${t.limit_period}` : ''}
                        </span>
                      )}
                    </TableCell>
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
            <DialogTitle>{editing ? 'Edit Claim Type' : 'Add Claim Type'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (values) => saveMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!!editing} placeholder="stationery" />
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
                        <Input {...field} placeholder="Stationery" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="final_approver"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Approver *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                          </SelectContent>
                        </Select>
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
                  name="limit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit Amount (RM)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={field.value == null ? '' : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          placeholder="20"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="limit_period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit Period</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="day / month / year"
                        />
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
