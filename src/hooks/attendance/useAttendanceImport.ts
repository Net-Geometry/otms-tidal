import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceCsvRow, AttendanceImport, AttendanceImportStatus } from '@/types/attendance';

type ImportError = { rowNumber: number; employee_id?: string; date?: string; message: string };

function isValidDateStr(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function normalizeTimeToHms(v: string) {
  const raw = (v || '').trim();
  if (!raw) return null;
  const m = raw.match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = m[2];
  const ss = String(Number(m[3] || '0')).padStart(2, '0');
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null;
  return `${hh}:${mm}:${ss}`;
}

function toMytTimestamp(dateStr: string, timeStr: string) {
  // Force MYT (+08:00) regardless of browser timezone
  return `${dateStr}T${timeStr}+08:00`;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useAttendanceImport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const [progress, setProgress] = useState(0);
  const [lastErrors, setLastErrors] = useState<ImportError[]>([]);

  const importsQuery = useQuery({
    queryKey: ['attendance-imports'],
    queryFn: async () => {
      const { data, error } = await db
        .from('attendance_imports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AttendanceImport[];
    },
    staleTime: 10 * 1000,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0);
      setLastErrors([]);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const text = await file.text();
      const parsed = Papa.parse<AttendanceCsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => String(h || '').trim(),
      });

      if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV');
      }

      const rows = (parsed.data || []).filter((r: any) => r && Object.keys(r).length > 0);
      if (rows.length === 0) throw new Error('CSV contains no rows');

      // Validate and collect unique employee codes
      const errors: ImportError[] = [];
      const employeeCodes = new Set<string>();
      const dates: string[] = [];

      rows.forEach((r, idx) => {
        const rowNumber = idx + 2; // header = 1
        const emp = String((r as any).employee_id || '').trim();
        const date = String((r as any).date || '').trim();
        if (!emp) errors.push({ rowNumber, message: 'Missing employee_id' });
        if (!date) errors.push({ rowNumber, employee_id: emp, message: 'Missing date' });
        if (date && !isValidDateStr(date)) errors.push({ rowNumber, employee_id: emp, date, message: 'Invalid date format (expected YYYY-MM-DD)' });
        if (emp) employeeCodes.add(emp);
        if (date && isValidDateStr(date)) dates.push(date);

        const t1 = (r as any).clock_in ? normalizeTimeToHms(String((r as any).clock_in)) : null;
        if ((r as any).clock_in && !t1) errors.push({ rowNumber, employee_id: emp, date, message: 'Invalid clock_in time format (expected HH:MM or HH:MM:SS)' });
        const t2 = (r as any).clock_out ? normalizeTimeToHms(String((r as any).clock_out)) : null;
        if ((r as any).clock_out && !t2) errors.push({ rowNumber, employee_id: emp, date, message: 'Invalid clock_out time format (expected HH:MM or HH:MM:SS)' });
        const t3 = (r as any).clock_in_2 ? normalizeTimeToHms(String((r as any).clock_in_2)) : null;
        if ((r as any).clock_in_2 && !t3) errors.push({ rowNumber, employee_id: emp, date, message: 'Invalid clock_in_2 time format' });
        const t4 = (r as any).clock_out_2 ? normalizeTimeToHms(String((r as any).clock_out_2)) : null;
        if ((r as any).clock_out_2 && !t4) errors.push({ rowNumber, employee_id: emp, date, message: 'Invalid clock_out_2 time format' });
      });

      // Lookup employee UUIDs by employee_id code
      const codeList = Array.from(employeeCodes);
      const codeToUuid = new Map<string, string>();
      for (const group of chunk(codeList, 500)) {
        const { data, error } = await db
          .from('profiles')
          .select('id, employee_id')
          .in('employee_id', group);
        if (error) throw error;
        for (const p of (data || []) as any[]) {
          if (p?.employee_id) codeToUuid.set(String(p.employee_id), String(p.id));
        }
      }

      // Lookup current shifts for these employees
      const uuids = Array.from(new Set(Array.from(codeToUuid.values())));
      const employeeToShift = new Map<string, { shift_id: string; allow_multiple_clockin: boolean }>();
      for (const group of chunk(uuids, 500)) {
        const { data, error } = await db
          .from('employee_shifts')
          .select('employee_id, shift_id, allow_multiple_clockin')
          .in('employee_id', group)
          .eq('is_current', true);
        if (error) throw error;
        for (const row of (data || []) as any[]) {
          employeeToShift.set(String(row.employee_id), {
            shift_id: String(row.shift_id),
            allow_multiple_clockin: !!row.allow_multiple_clockin,
          });
        }
      }

      // Create import batch row (processing)
      const dateStart = dates.sort()[0] || null;
      const dateEnd = dates.sort()[dates.length - 1] || null;
      const { data: importRow, error: importError } = await db
        .from('attendance_imports')
        .insert([
          {
            uploaded_by: authData.user.id,
            filename: file.name,
            file_size_bytes: file.size,
            record_count: rows.length,
            success_count: 0,
            error_count: 0,
            date_range_start: dateStart,
            date_range_end: dateEnd,
            status: 'processing',
            error_log: [],
          },
        ])
        .select('*')
        .single();
      if (importError) throw importError;

      const importId = String(importRow.id);

      // Build upsert payload
      const upserts: any[] = [];
      rows.forEach((r, idx) => {
        const rowNumber = idx + 2;
        const empCode = String((r as any).employee_id || '').trim();
        const date = String((r as any).date || '').trim();
        const employeeUuid = codeToUuid.get(empCode);
        if (!employeeUuid) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Employee not found' });
          return;
        }
        if (!isValidDateStr(date)) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Invalid date' });
          return;
        }

        const tIn = (r as any).clock_in ? normalizeTimeToHms(String((r as any).clock_in)) : null;
        const tOut = (r as any).clock_out ? normalizeTimeToHms(String((r as any).clock_out)) : null;
        const tIn2 = (r as any).clock_in_2 ? normalizeTimeToHms(String((r as any).clock_in_2)) : null;
        const tOut2 = (r as any).clock_out_2 ? normalizeTimeToHms(String((r as any).clock_out_2)) : null;

        if ((r as any).clock_in && !tIn) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Invalid clock_in' });
          return;
        }
        if ((r as any).clock_out && !tOut) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Invalid clock_out' });
          return;
        }
        if ((r as any).clock_in_2 && !tIn2) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Invalid clock_in_2' });
          return;
        }
        if ((r as any).clock_out_2 && !tOut2) {
          errors.push({ rowNumber, employee_id: empCode, date, message: 'Invalid clock_out_2' });
          return;
        }

        const status = tIn ? 'present' : ('absent' as any);
        const shift = employeeToShift.get(employeeUuid);

        upserts.push({
          employee_id: employeeUuid,
          date,
          clock_in: tIn ? toMytTimestamp(date, tIn) : null,
          clock_out: tOut ? toMytTimestamp(date, tOut) : null,
          clock_in_2: tIn2 ? toMytTimestamp(date, tIn2) : null,
          clock_out_2: tOut2 ? toMytTimestamp(date, tOut2) : null,
          shift_id: shift?.shift_id || null,
          status,
          source: 'import',
          import_id: importId,
          created_by: authData.user.id,
        });
      });

      const upsertChunks = chunk(upserts, 100);
      let successCount = 0;

      for (let i = 0; i < upsertChunks.length; i++) {
        const payload = upsertChunks[i];
        const { error } = await db
          .from('attendance_records')
          .upsert(payload, { onConflict: 'employee_id,date' });
        if (error) {
          errors.push({ rowNumber: -1, message: `Upsert failed (chunk ${i + 1}): ${error.message}` });
        } else {
          successCount += payload.length;
        }
        setProgress(Math.round(((i + 1) / upsertChunks.length) * 100));
      }

      const errorCount = Math.max(0, rows.length - successCount);
      const status: AttendanceImportStatus =
        successCount === 0 ? 'failed' : errorCount > 0 ? 'partial' : 'completed';

      const errorLog = errors.slice(0, 500); // avoid huge rows

      const { error: updateError } = await db
        .from('attendance_imports')
        .update({
          success_count: successCount,
          error_count: errorCount,
          status,
          error_log: errorLog,
        })
        .eq('id', importId);
      if (updateError) throw updateError;

      setLastErrors(errorLog);
      return { importId, successCount, errorCount, status, errors: errorLog };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-imports'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast({ title: 'Import completed', description: 'Attendance records have been uploaded' });
    },
    onError: (error: Error) => {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    },
  });

  const hasLastErrors = useMemo(() => (lastErrors || []).length > 0, [lastErrors]);

  return {
    importsQuery,
    importCsv: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    progress,
    lastErrors,
    hasLastErrors,
    reset: () => {
      setProgress(0);
      setLastErrors([]);
    },
  };
}
