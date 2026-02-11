import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDeductionTypes } from '@/hooks/payroll/usePayrollSettings';
import type { DeductionType } from '@/types/payroll';

export function DeductionTypeSetup() {
  const { data: types, isLoading, upsertDeductionType, deleteDeductionType, isUpserting } = useDeductionTypes();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DeductionType>>({});

  const openNew = () => {
    setEditing({ code: '', name: '', category: 'other', sort_order: 0 });
    setEditOpen(true);
  };

  const openEdit = (t: DeductionType) => {
    setEditing({ ...t });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing.code || !editing.name) return;
    await upsertDeductionType(editing as any);
    setEditOpen(false);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deduction Types</CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(types || []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell className="capitalize">{t.category}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDeductionType(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Edit' : 'Add'} Deduction Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input value={editing.code || ''} onChange={(e) => setEditing((p) => ({ ...p, code: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={editing.name || ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={editing.category || 'other'} onValueChange={(v) => setEditing((p) => ({ ...p, category: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="statutory">Statutory</SelectItem>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Sort Order</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing((p) => ({ ...p, sort_order: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isUpserting}>
                {isUpserting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
