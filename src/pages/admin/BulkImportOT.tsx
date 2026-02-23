import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CSVRow {
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: string;
  day_type: string;
  reason: string;
  ot_amount: string;
  ot_location_state: string;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; employee_id: string; error: string }>;
}

const VALID_DAY_TYPES = ['weekday', 'saturday', 'sunday', 'public_holiday'];

const TEMPLATE_HEADERS = [
  'employee_id', 'ot_date', 'start_time', 'end_time',
  'total_hours', 'day_type', 'reason', 'ot_amount', 'ot_location_state',
];

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 2 || values.every(v => !v)) continue; // skip empty rows

    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row as CSVRow);
  }

  return rows;
}

function validateRow(row: CSVRow, index: number): string[] {
  const errors: string[] = [];

  if (!row.employee_id) errors.push('Missing employee_id');
  if (!row.ot_date) errors.push('Missing ot_date');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.ot_date)) errors.push('Invalid date format (use YYYY-MM-DD)');
  if (!row.start_time) errors.push('Missing start_time');
  else if (!/^\d{2}:\d{2}$/.test(row.start_time)) errors.push('Invalid start_time (use HH:MM)');
  if (!row.end_time) errors.push('Missing end_time');
  else if (!/^\d{2}:\d{2}$/.test(row.end_time)) errors.push('Invalid end_time (use HH:MM)');
  if (!row.total_hours) errors.push('Missing total_hours');
  else if (isNaN(parseFloat(row.total_hours))) errors.push('total_hours must be a number');
  if (!row.day_type) errors.push('Missing day_type');
  else if (!VALID_DAY_TYPES.includes(row.day_type)) errors.push(`Invalid day_type: ${row.day_type}`);
  if (!row.reason) errors.push('Missing reason');
  if (row.ot_amount && isNaN(parseFloat(row.ot_amount))) errors.push('ot_amount must be a number');

  return errors;
}

function downloadTemplate() {
  const header = TEMPLATE_HEADERS.join(',');
  const example1 = 'EMP-001,2025-06-15,18:00,22:00,4.0,weekday,Project deadline,,SGR';
  const example2 = 'EMP-002,2025-06-16,08:00,16:00,8.0,saturday,Maintenance work,200.00,WPKL';
  const csv = [header, example1, example2].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ot-bulk-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportOT() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<number, string[]>>(new Map());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);

      // Validate all rows
      const errors = new Map<number, string[]>();
      parsed.forEach((row, idx) => {
        const rowErrors = validateRow(row, idx);
        if (rowErrors.length > 0) errors.set(idx, rowErrors);
      });
      setValidationErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (validationErrors.size > 0) {
      toast({
        title: 'Validation errors',
        description: 'Please fix all validation errors before importing.',
        variant: 'destructive',
      });
      return;
    }

    if (rows.length === 0) {
      toast({
        title: 'No data',
        description: 'Please upload a CSV file with OT records.',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      const db = supabase as any;
      const { data, error } = await db.rpc('bulk_import_ot_records', {
        p_records: rows,
      });

      if (error) throw error;

      setResult(data as ImportResult);
      toast({
        title: 'Import complete',
        description: `${data.imported} of ${data.total} records imported successfully.`,
      });
    } catch (err: any) {
      toast({
        title: 'Import failed',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setRows([]);
    setValidationErrors(new Map());
    setResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalErrors = validationErrors.size;
  const validRows = rows.length - totalErrors;

  return (
    <AppLayout>
      <PageLayout
        title="Bulk Import OT Records"
        description="Upload historical overtime records from CSV. Records will be imported as fully approved."
      >
        {/* Step 1: Download template */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Step 1: Download Template</CardTitle>
            <CardDescription>
              Download the CSV template, fill it in with historical OT data, then upload it below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Download CSV Template
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Upload CSV */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Step 2: Upload CSV</CardTitle>
            <CardDescription>
              Upload the filled CSV file. The data will be validated before import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {fileName || 'Choose CSV File'}
              </Button>
              {rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 text-muted-foreground">
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview table */}
        {rows.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview ({rows.length} rows)
              </CardTitle>
              <CardDescription>
                {totalErrors > 0 ? (
                  <span className="text-destructive">{totalErrors} row(s) have validation errors</span>
                ) : (
                  <span className="text-green-600">{validRows} rows ready for import</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>OT Date</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Day Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const errors = validationErrors.get(idx);
                      return (
                        <TableRow key={idx} className={errors ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-sm">{row.employee_id}</TableCell>
                          <TableCell>{row.ot_date}</TableCell>
                          <TableCell>{row.start_time}</TableCell>
                          <TableCell>{row.end_time}</TableCell>
                          <TableCell>{row.total_hours}</TableCell>
                          <TableCell>
                            {VALID_DAY_TYPES.includes(row.day_type) ? (
                              <Badge variant="secondary">{row.day_type}</Badge>
                            ) : (
                              <Badge variant="destructive">{row.day_type || '(empty)'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.reason}</TableCell>
                          <TableCell>{row.ot_amount || '-'}</TableCell>
                          <TableCell>{row.ot_location_state || '-'}</TableCell>
                          <TableCell>
                            {errors ? (
                              <span className="text-xs text-destructive" title={errors.join(', ')}>
                                {errors[0]}
                              </span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Import */}
        {rows.length > 0 && !result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Step 3: Import</CardTitle>
              <CardDescription>
                {validRows} valid record(s) will be imported as "Management Approved" with ticket prefix OT-LEGACY-
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleImport}
                disabled={importing || totalErrors > 0}
                className="gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import {validRows} Records
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Alert variant={result.skipped > 0 ? 'destructive' : 'default'} className="mb-6">
            {result.skipped > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>Import Complete</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1">
                <p>Total rows: <strong>{result.total}</strong></p>
                <p>Successfully imported: <strong className="text-green-600">{result.imported}</strong></p>
                {result.skipped > 0 && (
                  <p>Skipped: <strong className="text-destructive">{result.skipped}</strong></p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium mb-1">Errors:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.employee_id} - {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </PageLayout>
    </AppLayout>
  );
}
