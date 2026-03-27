import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Loader2 } from 'lucide-react';
import type { PayrollItem, PayrollRun } from '@/types/payroll';
import { generateFullPayslipPDF } from '@/lib/payslipPdfGenerator';
import { usePayrollSettings } from '@/hooks/payroll/usePayrollSettings';

interface GeneratePayslipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PayrollItem[];
  run: PayrollRun;
}

export function GeneratePayslipsDialog({
  open,
  onOpenChange,
  items,
  run,
}: GeneratePayslipsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const { settings } = usePayrollSettings();

  const allSelected = selected.size === items.length && items.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setIsGenerating(true);

    try {
      const selectedItems = items.filter((i) => selected.has(i.id));

      for (const item of selectedItems) {
        const profile = item.profiles;
        if (!profile) continue;

        await generateFullPayslipPDF({
          company: {
            name: run.companies?.name || 'Company',
            registration_no: run.companies?.registration_no || undefined,
          },
          employee: {
            name: profile.full_name || '',
            employeeNo: profile.employee_id || '',
            position: '',
            department: profile.departments?.name || '',
            icNo: profile.ic_no || '',
            epfNo: profile.epf_no || '',
            socsoNo: profile.socso_no || '',
            incomeTaxNo: profile.income_tax_no || '',
            bankName: profile.bank_name || '',
            bankAccountNo: profile.bank_account_no || '',
          },
          period: `${monthNames[run.pay_period_month] || run.pay_period_month} ${run.pay_period_year}`,
          showAllowance: settings?.show_allowance_on_payslip ?? false,
          item,
        });

        // Small delay between PDFs to avoid browser blocking
        if (selectedItems.length > 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Payslips</DialogTitle>
          <DialogDescription>
            Select employees to generate payslip PDFs for {monthNames[run.pay_period_month]} {run.pay_period_year}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2 border-b">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm font-medium">
            Select All ({items.length})
          </span>
          {selected.size > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {selected.size} selected
            </span>
          )}
        </div>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-1 py-1">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggleOne(item.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.profiles?.full_name || item.employee_id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.profiles?.employee_id || ''} {item.profiles?.departments?.name ? `- ${item.profiles.departments.name}` : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selected.size === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate {selected.size > 0 ? `(${selected.size})` : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
