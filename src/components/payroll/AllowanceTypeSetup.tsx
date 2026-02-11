import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAllowanceTypes } from '@/hooks/payroll/usePayrollSettings';
import type { AllowanceType } from '@/types/payroll';

export function AllowanceTypeSetup() {
  const { data: types, isLoading, upsertAllowanceType, deleteAllowanceType, isUpserting } = useAllowanceTypes();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AllowanceType>>({});

  const openNew = () => {
    setEditing({ code: '', name: '', is_epf_subject: true, is_socso_subject: true, is_eis_subject: true, is_taxable: true, default_amount: 0, sort_order: 0 });
    setEditOpen(true);
  };

  const openEdit = (t: AllowanceType) => {
    setEditing({ ...t });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing.code || !editing.name) return;
    await upsertAllowanceType(editing as any);
    setEditOpen(false);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Allowance Types</CardTitle>
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
              <TableHead>EPF</TableHead>
              <TableHead>SOCSO</TableHead>
              <TableHead>EIS</TableHead>
              <TableHead>Taxable</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(types || []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.is_epf_subject ? 'Yes' : 'No'}</TableCell>
                <TableCell>{t.is_socso_subject ? 'Yes' : 'No'}</TableCell>
                <TableCell>{t.is_eis_subject ? 'Yes' : 'No'}</TableCell>
                <TableCell>{t.is_taxable ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteAllowanceType(t.id)}>
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
              <DialogTitle>{editing.id ? 'Edit' : 'Add'} Allowance Type</DialogTitle>
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
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_epf_subject ?? true} onCheckedChange={(v) => setEditing((p) => ({ ...p, is_epf_subject: v }))} />
                  <Label className="text-xs">EPF Subject</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_socso_subject ?? true} onCheckedChange={(v) => setEditing((p) => ({ ...p, is_socso_subject: v }))} />
                  <Label className="text-xs">SOCSO Subject</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_eis_subject ?? true} onCheckedChange={(v) => setEditing((p) => ({ ...p, is_eis_subject: v }))} />
                  <Label className="text-xs">EIS Subject</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_taxable ?? true} onCheckedChange={(v) => setEditing((p) => ({ ...p, is_taxable: v }))} />
                  <Label className="text-xs">Taxable</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Default Amount (RM)</Label>
                  <Input type="number" value={editing.default_amount ?? 0} onChange={(e) => setEditing((p) => ({ ...p, default_amount: Number(e.target.value) }))} />
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
