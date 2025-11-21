/**
 * Bulk Holiday Import Component
 *
 * Component for bulk importing holidays via CSV upload.
 * Includes drag-and-drop, validation, progress tracking, and error reporting.
 */

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileDown, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { HolidayImportRow, BulkImportResult, HolidayOverrideType } from '@/types/holiday-overrides';
import { holidayOverrideService } from '@/services/HolidayOverrideService';

interface BulkHolidayImportProps {
  open: boolean;
  onClose: (imported: boolean) => void;
}

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export function BulkHolidayImport({ open, onClose }: BulkHolidayImportProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Invalid file type', {
        description: 'Please upload a CSV file.',
      });
      return;
    }

    if (file.size > 1024 * 1024) {
      // 1MB limit
      toast.error('File too large', {
        description: 'CSV file must be less than 1MB.',
      });
      return;
    }

    setCsvFile(file);
    setStatus('uploading');
    toast.success('File selected', {
      description: `${file.name} ready for import.`,
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const parseCsvFile = async (file: File): Promise<HolidayImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          // Skip header row
          const dataLines = lines.slice(1);

          const rows: HolidayImportRow[] = dataLines.map(line => {
            const [date, name, type, description] = line.split(',').map(s => s.trim());
            return {
              date,
              name,
              type: type as HolidayOverrideType,
              description: description || undefined,
            };
          });

          resolve(rows);
        } catch (error) {
          reject(new Error('Failed to parse CSV file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!csvFile) return;

    setStatus('processing');
    setProgress(0);

    try {
      // Parse CSV
      const rows = await parseCsvFile(csvFile);

      if (rows.length === 0) {
        toast.error('No data found', {
          description: 'The CSV file appears to be empty.',
        });
        setStatus('error');
        return;
      }

      // Show progress
      setProgress(25);

      // Import holidays
      const result = await holidayOverrideService.bulkImportOverrides(rows);
      setProgress(100);
      setImportResult(result);
      setStatus('complete');

      if (result.successful > 0) {
        toast.success('Import complete', {
          description: `Successfully imported ${result.successful} of ${rows.length} holidays.`,
        });
      }

      if (result.failed > 0) {
        toast.warning('Some imports failed', {
          description: `${result.failed} holidays could not be imported. Check the error list below.`,
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      setStatus('error');
    }
  };

  const handleDownloadTemplate = () => {
    const template = `date,name,type,description
2025-03-15,Company Founder Day,company,Annual company celebration
2025-06-20,Mid-Year Retreat,company,All-hands company retreat
2025-12-24,Christmas Eve (Company),company,Early closure day`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-holiday-template.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Template downloaded', {
      description: 'Use this template to format your holiday data.',
    });
  };

  const handleClose = () => {
    const imported = status === 'complete' && (importResult?.successful || 0) > 0;
    setCsvFile(null);
    setStatus('idle');
    setImportResult(null);
    setProgress(0);
    onClose(imported);
  };

  const handleReset = () => {
    setCsvFile(null);
    setStatus('idle');
    setImportResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Holidays</DialogTitle>
          <DialogDescription>
            Import multiple holidays from a CSV file. Download the template to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Button */}
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full"
            disabled={status === 'processing'}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          {/* File Upload Area */}
          {status !== 'complete' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {csvFile ? (
                <div>
                  <p className="font-medium">{csvFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-1">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">Maximum file size: 1MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Processing Progress */}
          {status === 'processing' && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Importing holidays... {progress}%
              </p>
            </div>
          )}

          {/* Import Results */}
          {status === 'complete' && importResult && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-around">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="text-2xl font-bold">{importResult.successful}</p>
                      <p className="text-sm text-muted-foreground">Successful</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <XCircle className="h-8 w-8 text-destructive" />
                      </div>
                      <p className="text-2xl font-bold">{importResult.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error List */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Import Errors
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertDescription>
                          <span className="font-medium">Row {error.row}:</span> {error.name} ({error.date})
                          <br />
                          <span className="text-sm">{error.error}</span>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CSV Format Guide */}
          {status === 'idle' && (
            <Alert>
              <AlertDescription>
                <p className="font-medium mb-2">CSV Format:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>First row must be headers: date, name, type, description</li>
                  <li>Date format: YYYY-MM-DD (e.g., 2025-03-15)</li>
                  <li>Type must be: company, emergency, or government</li>
                  <li>Description is optional</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {status === 'complete' ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Import More
              </Button>
              <Button onClick={handleClose}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={status === 'processing'}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!csvFile || status === 'processing'}
              >
                {status === 'processing' ? 'Importing...' : 'Import Holidays'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
