import { useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type {
  PayrollItem,
  AllowanceType,
  EmployeePayrollFormInput,
} from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';
import { round2 } from '@/lib/payrollUtils';

interface EmployeePayrollFormProps {
  item: PayrollItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: EmployeePayrollFormInput) => Promise<void>;
  isSaving: boolean;
  allowanceTypes: AllowanceType[];
  readOnly?: boolean;
}

export function EmployeePayrollForm({
  item,
  open,
  onOpenChange,
  onSave,
  isSaving,
  allowanceTypes,
  readOnly = false,
}: EmployeePayrollFormProps) {
  // Overtime & Leave
  const [otAmount, setOtAmount] = useState('0');
  const [unpaidDays, setUnpaidDays] = useState('0');

  // Allowances
  const [allowances, setAllowances] = useState<Record<string, string>>({});

  // Statutory toggles
  const [epfEnabled, setEpfEnabled] = useState(true);
  const [socsoEnabled, setSocsoEnabled] = useState(true);
  const [eisEnabled, setEisEnabled] = useState(true);
  const [pcbEnabled, setPcbEnabled] = useState(true);

  // Other deductions
  const [cp38, setCp38] = useState('0');
  const [zakat, setZakat] = useState('0');
  const [sportsClub, setSportsClub] = useState('0');
  const [staffLoan, setStaffLoan] = useState('0');
  const [rental, setRental] = useState('0');

  // Initialize state from item
  useEffect(() => {
    if (item) {
      setOtAmount(String(item.ot_amount || 0));
      setUnpaidDays(String(item.unpaid_leave_days || 0));

      // Allowances
      const allowanceMap: Record<string, string> = {};
      for (const a of item.payroll_item_allowances || []) {
        allowanceMap[a.allowance_type_id] = String(a.amount || 0);
      }
      setAllowances(allowanceMap);

      // Statutory toggles from calculation_notes
      const notes = item.calculation_notes || {};
      setEpfEnabled(!notes.epf_disabled);
      setSocsoEnabled(!notes.socso_disabled);
      setEisEnabled(!notes.eis_disabled);
      setPcbEnabled(!notes.pcb_disabled);

      // Other deductions
      setCp38(String(item.cp38_amount || 0));
      setZakat(String(item.zakat_amount || 0));
      setSportsClub(String(item.sports_club || 0));
      setStaffLoan(String(item.staff_loan || 0));
      setRental(String(item.rental_deduction || 0));
    }
  }, [item]);

  // Pay Summary calculation
  const summary = useMemo(() => {
    if (!item) return null;

    const ot = Number(otAmount) || 0;
    const unpaidDayCount = Number(unpaidDays) || 0;
    const dailyRate =
      Number(item.basic_salary) / Number(item.working_days || 26);
    const unpaidDeduction = round2(unpaidDayCount * dailyRate);

    const totalAllowancesSum = Object.values(allowances).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0
    );

    const grossPay = round2(Number(item.pro_rated_salary) + ot - unpaidDeduction);

    const empEpf = epfEnabled ? Number(item.employee_epf) : 0;
    const empSocso = socsoEnabled ? Number(item.employee_socso) : 0;
    const empEis = eisEnabled ? Number(item.employee_eis) : 0;
    const pcb = pcbEnabled ? Number(item.pcb_amount) : 0;
    const manualDed =
      (Number(cp38) || 0) +
      (Number(zakat) || 0) +
      (Number(sportsClub) || 0) +
      (Number(staffLoan) || 0) +
      (Number(rental) || 0);

    const totalDeductions = round2(
      empEpf + empSocso + empEis + pcb + manualDed + unpaidDeduction
    );
    const netPay = round2(
      grossPay + totalAllowancesSum - totalDeductions + unpaidDeduction
    );

    const erEpf = epfEnabled ? Number(item.employer_epf) : 0;
    const erSocso = socsoEnabled ? Number(item.employer_socso) : 0;
    const erEis = eisEnabled ? Number(item.employer_eis) : 0;
    const erHrdc = Number(item.employer_hrdc);
    const companyContrib = round2(erEpf + erSocso + erEis + erHrdc);

    const directorFee = item.is_director ? Number(item.director_fee) : 0;

    return {
      grossPay,
      totalAllowancesSum,
      totalDeductions,
      netPay,
      companyContrib,
      directorFee,
      unpaidDeduction,
    };
  }, [
    item,
    otAmount,
    unpaidDays,
    allowances,
    cp38,
    zakat,
    sportsClub,
    staffLoan,
    rental,
    epfEnabled,
    socsoEnabled,
    eisEnabled,
    pcbEnabled,
  ]);

  if (!item) return null;

  const handleSave = async () => {
    if (!summary) return;

    const numOt = Number(otAmount) || 0;
    const numUnpaidDays = Number(unpaidDays) || 0;
    const numCp38 = Number(cp38) || 0;
    const numZakat = Number(zakat) || 0;
    const numSports = Number(sportsClub) || 0;
    const numLoan = Number(staffLoan) || 0;
    const numRental = Number(rental) || 0;

    await onSave({
      itemId: item.id,
      payrollRunId: item.payroll_run_id,
      updates: {
        ot_amount: numOt,
        unpaid_leave_days: numUnpaidDays,
        unpaid_leave_deduction: summary.unpaidDeduction,
        gross_salary: summary.grossPay,
        total_allowances: round2(summary.totalAllowancesSum),
        total_deductions: summary.totalDeductions,
        net_salary: summary.netPay,
        cp38_amount: numCp38,
        zakat_amount: numZakat,
        sports_club: numSports,
        staff_loan: numLoan,
        rental_deduction: numRental,
        // When statutory toggle is off, save 0 for both employee and employer
        employee_epf: epfEnabled ? Number(item.employee_epf) : 0,
        employer_epf: epfEnabled ? Number(item.employer_epf) : 0,
        employee_socso: socsoEnabled ? Number(item.employee_socso) : 0,
        employer_socso: socsoEnabled ? Number(item.employer_socso) : 0,
        employee_eis: eisEnabled ? Number(item.employee_eis) : 0,
        employer_eis: eisEnabled ? Number(item.employer_eis) : 0,
        pcb_amount: pcbEnabled ? Number(item.pcb_amount) : 0,
        calculation_notes: {
          ...item.calculation_notes,
          manually_edited: true,
          epf_disabled: !epfEnabled,
          socso_disabled: !socsoEnabled,
          eis_disabled: !eisEnabled,
          pcb_disabled: !pcbEnabled,
        },
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
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {item.profiles?.full_name || 'Employee'}
            {item.is_pro_rated && (
              <Badge variant="secondary">Pro-rated</Badge>
            )}
            {item.is_director && (
              <Badge variant="outline">Director</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Review and edit payroll details for this employee.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Section 1: Basic Earning (read-only) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Basic Earning</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Basic Salary:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(Number(item.basic_salary))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Pro-rated Salary:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(Number(item.pro_rated_salary))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Working Days:</span>
                <span className="ml-2 font-medium">{item.working_days}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Days Worked:</span>
                <span className="ml-2 font-medium">{item.days_worked}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Overtime & Leave (editable) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Overtime & Leave</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">OT Amount (RM)</Label>
                <Input
                  type="number"
                  value={otAmount}
                  onChange={(e) => setOtAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unpaid Leave Days</Label>
                <Input
                  type="number"
                  value={unpaidDays}
                  onChange={(e) => setUnpaidDays(e.target.value)}
                  min="0"
                  step="0.5"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 3: Allowances (editable) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Additional Earnings / Allowances</h4>
            {allowanceTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No allowance types configured.
              </p>
            )}
            {allowanceTypes.map((at) => (
              <div key={at.id} className="space-y-1">
                <Label className="text-xs">{at.name} (RM)</Label>
                <Input
                  type="number"
                  value={allowances[at.id] || '0'}
                  onChange={(e) =>
                    setAllowances((prev) => ({
                      ...prev,
                      [at.id]: e.target.value,
                    }))
                  }
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Section 4: Statutory Deductions (toggleable) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Statutory Deductions</h4>

            <div className="space-y-3">
              {/* EPF */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="epf-toggle"
                    checked={epfEnabled}
                    onCheckedChange={(checked) =>
                      setEpfEnabled(checked === true)
                    }
                    disabled={readOnly}
                  />
                  <Label htmlFor="epf-toggle" className="text-sm font-medium">
                    EPF
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  Employee: {formatCurrency(Number(item.employee_epf))} /
                  Employer: {formatCurrency(Number(item.employer_epf))}
                </span>
              </div>

              {/* SOCSO */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="socso-toggle"
                    checked={socsoEnabled}
                    onCheckedChange={(checked) =>
                      setSocsoEnabled(checked === true)
                    }
                    disabled={readOnly}
                  />
                  <Label
                    htmlFor="socso-toggle"
                    className="text-sm font-medium"
                  >
                    SOCSO
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  Employee: {formatCurrency(Number(item.employee_socso))} /
                  Employer: {formatCurrency(Number(item.employer_socso))}
                </span>
              </div>

              {/* EIS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="eis-toggle"
                    checked={eisEnabled}
                    onCheckedChange={(checked) =>
                      setEisEnabled(checked === true)
                    }
                    disabled={readOnly}
                  />
                  <Label htmlFor="eis-toggle" className="text-sm font-medium">
                    EIS
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  Employee: {formatCurrency(Number(item.employee_eis))} /
                  Employer: {formatCurrency(Number(item.employer_eis))}
                </span>
              </div>

              {/* PCB/MTD */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pcb-toggle"
                    checked={pcbEnabled}
                    onCheckedChange={(checked) =>
                      setPcbEnabled(checked === true)
                    }
                    disabled={readOnly}
                  />
                  <Label htmlFor="pcb-toggle" className="text-sm font-medium">
                    PCB / MTD
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(Number(item.pcb_amount))}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 5: Other Deductions (editable) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Other Deductions</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CP38 (RM)</Label>
                <Input
                  type="number"
                  value={cp38}
                  onChange={(e) => setCp38(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zakat (RM)</Label>
                <Input
                  type="number"
                  value={zakat}
                  onChange={(e) => setZakat(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sports Club (RM)</Label>
                <Input
                  type="number"
                  value={sportsClub}
                  onChange={(e) => setSportsClub(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Staff Loan (RM)</Label>
                <Input
                  type="number"
                  value={staffLoan}
                  onChange={(e) => setStaffLoan(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rental (RM)</Label>
                <Input
                  type="number"
                  value={rental}
                  onChange={(e) => setRental(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 6: Pay Summary (auto-calculated, read-only) */}
          {summary && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Pay Summary</h4>
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Basic Pay</span>
                  <span>{formatCurrency(Number(item.pro_rated_salary))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ OT Amount</span>
                  <span>{formatCurrency(Number(otAmount) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    - Unpaid Leave Deduction
                  </span>
                  <span className="text-destructive">
                    -{formatCurrency(summary.unpaidDeduction)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>= Gross Pay</span>
                  <span>{formatCurrency(summary.grossPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    + Total Allowances
                  </span>
                  <span>{formatCurrency(summary.totalAllowancesSum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    - Total Deductions
                  </span>
                  <span className="text-destructive">
                    -{formatCurrency(summary.totalDeductions)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>= Net Pay</span>
                  <span
                    className={
                      summary.netPay < 0 ? 'text-destructive' : ''
                    }
                  >
                    {formatCurrency(summary.netPay)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Company Contributions
                  </span>
                  <span>{formatCurrency(summary.companyContrib)}</span>
                </div>
                {summary.directorFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Director Fee</span>
                    <span>{formatCurrency(summary.directorFee)}</span>
                  </div>
                )}
              </div>

              {summary.netPay < 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Net pay is negative. Verify deductions are correct.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Separator />

          {/* Section 7: Footer */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
