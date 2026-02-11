import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { PayrollItem, AllowanceType, DeductionType } from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';

interface PayrollItemEditSheetProps {
  item: PayrollItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    itemId: string;
    updates: Partial<PayrollItem>;
    allowances?: { allowance_type_id: string; amount: number }[];
    deductions?: { deduction_type_id: string; amount: number }[];
  }) => Promise<void>;
  isSaving: boolean;
  allowanceTypes: AllowanceType[];
  deductionTypes: DeductionType[];
}

export function PayrollItemEditSheet({
  item,
  open,
  onOpenChange,
  onSave,
  isSaving,
  allowanceTypes,
  deductionTypes,
}: PayrollItemEditSheetProps) {
  const [pcb, setPcb] = useState('0');
  const [cp38, setCp38] = useState('0');
  const [zakat, setZakat] = useState('0');
  const [sportsClub, setSportsClub] = useState('0');
  const [staffLoan, setStaffLoan] = useState('0');
  const [rental, setRental] = useState('0');
  const [otAmount, setOtAmount] = useState('0');
  const [unpaidDays, setUnpaidDays] = useState('0');
  const [allowances, setAllowances] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setPcb(String(item.pcb_amount || 0));
      setCp38(String(item.cp38_amount || 0));
      setZakat(String(item.zakat_amount || 0));
      setSportsClub(String(item.sports_club || 0));
      setStaffLoan(String(item.staff_loan || 0));
      setRental(String(item.rental_deduction || 0));
      setOtAmount(String(item.ot_amount || 0));
      setUnpaidDays(String(item.unpaid_leave_days || 0));

      const allowanceMap: Record<string, string> = {};
      for (const a of item.payroll_item_allowances || []) {
        allowanceMap[a.allowance_type_id] = String(a.amount || 0);
      }
      setAllowances(allowanceMap);
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    const numPcb = Number(pcb) || 0;
    const numCp38 = Number(cp38) || 0;
    const numZakat = Number(zakat) || 0;
    const numSports = Number(sportsClub) || 0;
    const numLoan = Number(staffLoan) || 0;
    const numRental = Number(rental) || 0;
    const numOt = Number(otAmount) || 0;
    const numUnpaidDays = Number(unpaidDays) || 0;

    const dailyRate = Number(item.basic_salary) / Number(item.working_days);
    const unpaidDeduction = Math.round(numUnpaidDays * dailyRate * 100) / 100;

    const totalAllowancesSum = Object.values(allowances).reduce(
      (sum, v) => sum + (Number(v) || 0), 0
    );

    const totalDed =
      Number(item.employee_epf) + Number(item.employee_socso) + Number(item.employee_eis) +
      numPcb + numCp38 + numZakat + numSports + numLoan + numRental + unpaidDeduction;

    const grossSalary = Number(item.pro_rated_salary) + numOt - unpaidDeduction;
    const netSalary = grossSalary + totalAllowancesSum - totalDed + unpaidDeduction;

    await onSave({
      itemId: item.id,
      updates: {
        pcb_amount: numPcb,
        cp38_amount: numCp38,
        zakat_amount: numZakat,
        sports_club: numSports,
        staff_loan: numLoan,
        rental_deduction: numRental,
        ot_amount: numOt,
        unpaid_leave_days: numUnpaidDays,
        unpaid_leave_deduction: unpaidDeduction,
        gross_salary: Math.round(grossSalary * 100) / 100,
        total_allowances: Math.round(totalAllowancesSum * 100) / 100,
        total_deductions: Math.round(totalDed * 100) / 100,
        net_salary: Math.round(netSalary * 100) / 100,
      },
      allowances: allowanceTypes.map((at) => ({
        allowance_type_id: at.id,
        amount: Number(allowances[at.id] || 0),
      })),
    });

    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item.profiles?.full_name || 'Employee'}</SheetTitle>
          <SheetDescription>
            Edit payroll adjustments for this employee.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Basic Salary:</span>
              <span className="ml-2 font-medium">{formatCurrency(Number(item.basic_salary))}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pro-rated:</span>
              <span className="ml-2 font-medium">{formatCurrency(Number(item.pro_rated_salary))}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Overtime & Leave</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">OT Amount (RM)</Label>
                <Input type="number" value={otAmount} onChange={(e) => setOtAmount(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unpaid Leave Days</Label>
                <Input type="number" value={unpaidDays} onChange={(e) => setUnpaidDays(e.target.value)} min="0" step="0.5" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Allowances</h4>
            {allowanceTypes.map((at) => (
              <div key={at.id} className="space-y-1">
                <Label className="text-xs">{at.name} (RM)</Label>
                <Input
                  type="number"
                  value={allowances[at.id] || '0'}
                  onChange={(e) => setAllowances((prev) => ({ ...prev, [at.id]: e.target.value }))}
                  min="0"
                  step="0.01"
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Tax & Statutory Deductions</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">PCB / MTD (RM)</Label>
                <Input type="number" value={pcb} onChange={(e) => setPcb(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CP38 (RM)</Label>
                <Input type="number" value={cp38} onChange={(e) => setCp38(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zakat (RM)</Label>
                <Input type="number" value={zakat} onChange={(e) => setZakat(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Other Deductions</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sports Club (RM)</Label>
                <Input type="number" value={sportsClub} onChange={(e) => setSportsClub(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Staff Loan (RM)</Label>
                <Input type="number" value={staffLoan} onChange={(e) => setStaffLoan(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rental (RM)</Label>
                <Input type="number" value={rental} onChange={(e) => setRental(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
