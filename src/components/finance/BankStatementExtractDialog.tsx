// src/components/finance/BankStatementExtractDialog.tsx
import { useRef, useState } from 'react';
import { Bot, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  extractBankStatement,
  getApiKey,
  type ExtractionResult,
} from '@/lib/bankStatementExtractor';

function formatMoney(value: number) {
  if (!value) return '-';
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (result: ExtractionResult) => void;
}

export function BankStatementExtractDialog({ open, onOpenChange, onExtracted }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const hasApiKey = !!getApiKey();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setResult(null);
    } else if (selected) {
      toast({ title: 'Invalid file', description: 'Please select a PDF file', variant: 'destructive' });
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setProgress('Starting extraction...');
    try {
      const extracted = await extractBankStatement(file, setProgress);
      setResult(extracted);
      setProgress('');
      toast({
        title: 'Extraction complete',
        description: `Found ${extracted.transactions.length} transactions`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Extraction failed';
      toast({ title: 'Extraction failed', description: message, variant: 'destructive' });
      setProgress('');
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = () => {
    if (result) {
      onExtracted(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setProgress('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Extract Bank Statement (AI)
          </DialogTitle>
          <DialogDescription>
            Upload a bank statement PDF. AI will extract transactions for auto-matching.
          </DialogDescription>
        </DialogHeader>

        {!hasApiKey ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <p>No OpenRouter API key configured.</p>
            <p className="mt-1">Go to <strong>Settings</strong> to add your API key.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File upload */}
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={extracting}
              >
                <FileUp className="mr-2 h-4 w-4" />
                {file ? file.name : 'Choose PDF'}
              </Button>
              <Button
                onClick={handleExtract}
                disabled={!file || extracting}
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progress || 'Extracting...'}
                  </>
                ) : (
                  'Extract'
                )}
              </Button>
            </div>

            {/* Results */}
            {result && (
              <>
                <div className="grid gap-2 text-sm md:grid-cols-4">
                  <p><span className="text-muted-foreground">Bank:</span> {result.bankName || '-'}</p>
                  <p><span className="text-muted-foreground">Account:</span> {result.accountNumber || '-'}</p>
                  <p><span className="text-muted-foreground">Statement Date:</span> {result.statementDate || '-'}</p>
                  <p><span className="text-muted-foreground">Closing Balance:</span> {formatMoney(result.closingBalance)}</p>
                </div>

                <div className="rounded-md border max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.transactions.map((txn, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                          <TableCell>{txn.description}</TableCell>
                          <TableCell>{txn.reference || '-'}</TableCell>
                          <TableCell className="text-right">{formatMoney(txn.debit)}</TableCell>
                          <TableCell className="text-right">{formatMoney(txn.credit)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <p className="text-sm text-muted-foreground">
                  {result.transactions.length} transactions extracted
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {result && (
            <Button onClick={handleConfirm}>
              Use for Auto-Match
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
