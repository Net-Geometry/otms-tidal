import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, Settings2, UploadCloud, Users2, Workflow, CalendarDays } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { AttendanceDashboardCards } from '@/components/attendance/AttendanceDashboardCards';
import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import { AttendanceDetailsSheet } from '@/components/attendance/AttendanceDetailsSheet';
import { AttendanceImportDialog } from '@/components/attendance/AttendanceImportDialog';
import { ShiftManagement } from '@/components/attendance/ShiftManagement';
import { EmployeeShiftAssignment } from '@/components/attendance/EmployeeShiftAssignment';
import { AttendanceSettings } from '@/components/attendance/AttendanceSettings';
import { AttendanceSummaryReport } from '@/components/attendance/AttendanceSummaryReport';

import { useAttendanceRecords } from '@/hooks/attendance/useAttendanceRecords';
import { useAttendanceImport } from '@/hooks/attendance/useAttendanceImport';
import type { AttendanceRecord, AttendanceRecordStatus } from '@/types/attendance';

type Section = 'daily' | 'import' | 'shifts' | 'settings' | 'reports';
type DailyTab = 'all' | 'present' | 'late' | 'absent';

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

function statusFilter(tab: DailyTab): AttendanceRecordStatus[] | undefined {
  if (tab === 'present') return ['present'];
  if (tab === 'late') return ['late'];
  if (tab === 'absent') return ['absent'];
  return undefined;
}

export default function Attendance() {
  const [section, setSection] = useState<Section>('daily');
  const [tab, setTab] = useState<DailyTab>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(daysAgoStr(7));
  const [endDate, setEndDate] = useState(todayStr());
  const [importOpen, setImportOpen] = useState(false);

  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const records = useAttendanceRecords({
    startDate,
    endDate,
    statuses: statusFilter(tab),
  });

  const imports = useAttendanceImport();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = records.data || [];
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.profiles?.full_name || '';
      const code = r.profiles?.employee_id || '';
      return name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || r.employee_id.toLowerCase().includes(q);
    });
  }, [records.data, search]);

  return (
    <AppLayout>
      <PageLayout title="Attendance Management" description="Import attendance, manage shifts, and review monthly summaries.">
        <AttendanceDashboardCards />

        <Tabs value={section} onValueChange={(v) => setSection(v as Section)} className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="daily" className="gap-2">
              <Users2 className="h-4 w-4" />
              Daily Records
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-2">
              <Workflow className="h-4 w-4" />
              Shifts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-6">
            <Card className="p-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as DailyTab)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="present">Present</TabsTrigger>
                  <TabsTrigger value="late">Late</TabsTrigger>
                  <TabsTrigger value="absent">Absent</TabsTrigger>
                </TabsList>

                <TabsContent value={tab} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by employee name or ID..."
                        className="pl-9"
                      />
                    </div>
                    <div>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>

                  <AttendanceTable
                    records={filtered}
                    isLoading={records.isLoading}
                    showEmployee
                    onSelect={(r) => {
                      setSelected(r);
                      setSheetOpen(true);
                    }}
                  />

                  <AttendanceDetailsSheet
                    record={selected}
                    open={sheetOpen}
                    onOpenChange={(o) => {
                      setSheetOpen(o);
                      if (!o) setSelected(null);
                    }}
                    editable
                    onSave={async (id, values) => {
                      await records.updateRecord({ id, values } as any);
                    }}
                    onDelete={async (id) => {
                      await records.deleteRecord({ id });
                    }}
                    isSaving={records.isUpdating}
                    isDeleting={records.isDeleting}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">Import History</div>
                  <div className="text-sm text-muted-foreground">CSV uploads performed by HR.</div>
                </div>
                <Button className="gap-2" onClick={() => setImportOpen(true)}>
                  <UploadCloud className="h-4 w-4" />
                  Import CSV
                </Button>
              </div>

              {imports.importsQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading imports...</div>
              ) : (imports.importsQuery.data || []).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No imports yet.</div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Records</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                        <TableHead>Date Range</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(imports.importsQuery.data || []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.filename}</TableCell>
                          <TableCell className="font-mono text-xs">{r.status}</TableCell>
                          <TableCell className="text-right">{r.record_count}</TableCell>
                          <TableCell className="text-right">{r.success_count}</TableCell>
                          <TableCell className="text-right">{r.error_count}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.date_range_start || '—'} - {r.date_range_end || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <AttendanceImportDialog open={importOpen} onOpenChange={setImportOpen} />
            </Card>
          </TabsContent>

          <TabsContent value="shifts" className="mt-6 space-y-4">
            <ShiftManagement />
            <EmployeeShiftAssignment />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AttendanceSettings />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <AttendanceSummaryReport />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
