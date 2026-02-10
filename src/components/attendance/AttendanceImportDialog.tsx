import { useMemo, useState } from 'react';
import Papa from 'papaparse';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { useAttendanceImport } from '@/hooks/attendance/useAttendanceImport';
import type { AttendanceCsvRow } from '@/types/attendance';

type Step = 'upload' | 'importing' | 'done';

export function AttendanceImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const imp = useAttendanceImport();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<AttendanceCsvRow[]>([]);

  const canImport = !!file && !imp.isImporting;

  const previewRows = useMemo(() => preview.slice(0, 10), [preview]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setFile(null);
          setPreview([]);
          setStep('upload');
          imp.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Attendance CSV</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Expected columns: <span className="font-mono text-xs">employee_id</span>, <span className="font-mono text-xs">date</span>, <span className="font-mono text-xs">clock_in</span>, <span className="font-mono text-xs">clock_out</span>, <span className="font-mono text-xs">clock_in_2</span> (optional), <span className="font-mono text-xs">clock_out_2</span> (optional)
            </div>

            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                setPreview([]);
                if (!f) return;
                const text = await f.text();
                const parsed = Papa.parse<AttendanceCsvRow>(text, {
                  header: true,
                  skipEmptyLines: true,
                  transformHeader: (h) => String(h || '').trim(),
                });
                setPreview((parsed.data || []).filter((r: any) => r && Object.keys(r).length > 0));
              }}
            />

            {previewRows.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Preview (first {previewRows.length} rows)</div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>employee_id</TableHead>
                        <TableHead>date</TableHead>
                        <TableHead>clock_in</TableHead>
                        <TableHead>clock_out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{r.employee_id}</TableCell>
                          <TableCell className="font-mono text-xs">{r.date}</TableCell>
                          <TableCell className="font-mono text-xs">{r.clock_in || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.clock_out || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Uploading and processing...</div>
            <Progress value={imp.progress} />
            <div className="text-xs text-muted-foreground">{imp.progress}%</div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Import result</div>
              <Badge variant={imp.hasLastErrors ? 'secondary' : 'default'}>
                {imp.hasLastErrors ? 'Partial' : 'Completed'}
              </Badge>
            </div>
            {imp.hasLastErrors ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Some rows failed validation/upsert (showing up to 20):</div>
                <div className="rounded-md border p-3 max-h-56 overflow-auto text-xs">
                  {(imp.lastErrors || []).slice(0, 20).map((e, idx) => (
                    <div key={idx} className="font-mono">
                      {e.rowNumber > 0 ? `Row ${e.rowNumber}: ` : ''}{e.message}
                      {e.employee_id ? ` (employee_id=${e.employee_id})` : ''}
                      {e.date ? ` (date=${e.date})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">All records imported successfully.</div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canImport}
                onClick={async () => {
                  if (!file) return;
                  setStep('importing');
                  await imp.importCsv(file);
                  setStep('done');
                }}
              >
                Import
              </Button>
            </>
          )}

          {step === 'importing' && (
            <Button type="button" variant="outline" disabled>
              Importing...
            </Button>
          )}

          {step === 'done' && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
