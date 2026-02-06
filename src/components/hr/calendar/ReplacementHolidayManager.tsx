import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { holidayConfigService } from '@/services/HolidayConfigService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StateCodeBadge } from '@/components/hr/calendar/StateCodeBadge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Action = 'approve' | 'modify' | 'delete';

export function ReplacementHolidayManager({ initialYear }: { initialYear?: number }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState<number>(initialYear || new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<Action>('approve');
  const [modalHoliday, setModalHoliday] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['replacement-holidays', year],
    queryFn: () => holidayConfigService.getReplacementHolidays(year),
  });

  const items = useMemo(() => (data || []) as any[], [data]);

  const openModal = (action: Action, holiday: any) => {
    setModalAction(action);
    setModalHoliday(holiday);
    setReason('');
    setNewDate(holiday?.date || '');
    setNewName(holiday?.name || '');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!modalHoliday?.id) return;
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setSaving(true);
    try {
      if (modalAction === 'approve') {
        const resp = await holidayConfigService.overrideReplacementHoliday(modalHoliday.id, 'approve', reason.trim());
        if (!resp.success) throw new Error(resp.error || 'Approve failed');
        toast.success('Approved');
      }

      if (modalAction === 'delete') {
        const resp = await holidayConfigService.overrideReplacementHoliday(modalHoliday.id, 'delete', reason.trim());
        if (!resp.success) throw new Error(resp.error || 'Delete failed');
        toast.success('Deleted');
      }

      if (modalAction === 'modify') {
        const resp = await holidayConfigService.modifyReplacementHoliday(
          modalHoliday.id,
          { date: newDate || undefined, name: newName || undefined },
          reason.trim(),
        );
        if (!resp.success) throw new Error(resp.error || 'Modify failed');
        toast.success('Updated');
      }

      await queryClient.invalidateQueries({ queryKey: ['replacement-holidays'] });
      setModalOpen(false);
    } catch (e) {
      toast.error('Action failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Replacement Holidays (Replacement Leave)</div>
          <div className="text-xs text-muted-foreground">Calculated from scraped holidays based on weekend configuration.</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="repl-year">Year</Label>
          <Input
            id="repl-year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-32"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No replacement holidays found for {year}.</div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Date</th>
                <th className="p-2">State</th>
                <th className="p-2">Name</th>
                <th className="p-2">HR Override</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="p-2 text-xs text-muted-foreground">{h.date ? format(new Date(h.date), 'PP') : '-'}</td>
                  <td className="p-2"><StateCodeBadge code={h.state} /></td>
                  <td className="p-2 font-medium">{h.name}</td>
                  <td className="p-2">
                    {h.hr_override_at ? (
                      <Badge variant="secondary">overridden</Badge>
                    ) : (
                      <Badge variant="outline">auto</Badge>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openModal('approve', h)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openModal('modify', h)}>
                        Modify
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openModal('delete', h)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalAction === 'approve' ? 'Approve Replacement Holiday' : modalAction === 'modify' ? 'Modify Replacement Holiday' : 'Delete Replacement Holiday'}
            </DialogTitle>
          </DialogHeader>

          {modalHoliday && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {modalHoliday.date ? format(new Date(modalHoliday.date), 'PP') : '-'} - {modalHoliday.name}
              </div>

              {modalAction === 'modify' && (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-date">New Date</Label>
                    <Input id="new-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-name">New Name</Label>
                    <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={modalAction === 'delete' ? 'destructive' : 'default'}
              onClick={submit}
              disabled={saving}
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
