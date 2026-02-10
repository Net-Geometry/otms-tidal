import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { useShifts } from '@/hooks/attendance/useShifts';
import type { Shift } from '@/types/attendance';

const schema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  start_time: z.string().min(4).max(8),
  end_time: z.string().min(4).max(8),
  grace_period_minutes: z.coerce.number().min(0).default(0),
  is_overnight: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().default(0),
});

type Values = z.infer<typeof schema>;

export function ShiftManagement() {
  const shifts = useShifts({ includeInactive: true });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);

  const defaults = useMemo<Values>(() => {
    const s = editing;
    return {
      code: s?.code || '',
      name: s?.name || '',
      start_time: String(s?.start_time || '08:30').slice(0, 5),
      end_time: String(s?.end_time || '17:30').slice(0, 5),
      grace_period_minutes: Number(s?.grace_period_minutes || 0),
      is_overnight: !!s?.is_overnight,
      is_active: s?.is_active ?? true,
      sort_order: Number(s?.sort_order || 0),
    };
  }, [editing]);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shifts</CardTitle>
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
        {shifts.isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Grace</TableHead>
                  <TableHead>Overnight</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shifts.data || []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(s.start_time).slice(0, 5)}-{String(s.end_time).slice(0, 5)}
                    </TableCell>
                    <TableCell className="text-right">{Number(s.grace_period_minutes || 0)}</TableCell>
                    <TableCell>{s.is_overnight ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!s.is_active}
                          onCheckedChange={(v) => shifts.updateShift({ id: s.id, is_active: !!v })}
                        />
                        <span className="text-sm text-muted-foreground">{s.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setEditing(s);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={async () => {
                            await shifts.deleteShift({ id: s.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
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
            <DialogTitle>{editing ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                if (editing) {
                  await shifts.updateShift({
                    id: editing.id,
                    name: values.name,
                    start_time: values.start_time,
                    end_time: values.end_time,
                    grace_period_minutes: values.grace_period_minutes,
                    is_overnight: values.is_overnight,
                    is_active: values.is_active,
                    sort_order: values.sort_order,
                  });
                } else {
                  await shifts.createShift({
                    code: values.code,
                    name: values.name,
                    start_time: values.start_time,
                    end_time: values.end_time,
                    grace_period_minutes: values.grace_period_minutes,
                    is_overnight: values.is_overnight,
                    is_active: values.is_active,
                    sort_order: values.sort_order,
                  } as any);
                }
                setOpen(false);
                setEditing(null);
              })}
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
                        <Input {...field} disabled={!!editing} placeholder="REG" />
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
                        <Input {...field} placeholder="Regular Shift" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="time" step={60} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="time" step={60} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grace_period_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="is_overnight"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div className="text-sm font-medium">Overnight</div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
