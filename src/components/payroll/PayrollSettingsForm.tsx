import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePayrollSettings } from '@/hooks/payroll/usePayrollSettings';
import type { PayrollSettings } from '@/types/payroll';

export function PayrollSettingsForm() {
  const { settings, isLoading, updateSettings, isSaving } = usePayrollSettings();
  const [form, setForm] = useState<Partial<PayrollSettings>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        employer_epf_rate: settings.employer_epf_rate,
        employee_epf_rate_below_60: settings.employee_epf_rate_below_60,
        employee_epf_rate_above_60: settings.employee_epf_rate_above_60,
        socso_scheme: settings.socso_scheme,
        eis_employer_rate: settings.eis_employer_rate,
        eis_employee_rate: settings.eis_employee_rate,
        eis_wage_ceiling: settings.eis_wage_ceiling,
        hrdc_rate: settings.hrdc_rate,
        hrdc_enabled: settings.hrdc_enabled,
        working_days_per_month: settings.working_days_per_month,
        payroll_cutoff_day: settings.payroll_cutoff_day,
        show_allowance_on_payslip: settings.show_allowance_on_payslip,
        memo_number_prefix: settings.memo_number_prefix,
      });
    }
  }, [settings]);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const handleSave = async () => {
    await updateSettings(form);
  };

  const set = (key: keyof PayrollSettings, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payroll Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">EPF Rates (%)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Employer</Label>
              <Input
                type="number"
                value={form.employer_epf_rate ?? ''}
                onChange={(e) => set('employer_epf_rate', Number(e.target.value))}
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Employee (&lt;60)</Label>
              <Input
                type="number"
                value={form.employee_epf_rate_below_60 ?? ''}
                onChange={(e) => set('employee_epf_rate_below_60', Number(e.target.value))}
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Employee (&ge;60)</Label>
              <Input
                type="number"
                value={form.employee_epf_rate_above_60 ?? ''}
                onChange={(e) => set('employee_epf_rate_above_60', Number(e.target.value))}
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">SOCSO</h4>
          <div className="space-y-1">
            <Label className="text-xs">Scheme</Label>
            <Select
              value={form.socso_scheme || 'both'}
              onValueChange={(v) => set('socso_scheme', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (Employment Injury + Invalidity)</SelectItem>
                <SelectItem value="employment_injury">Employment Injury Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">EIS</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Employer Rate (%)</Label>
              <Input
                type="number"
                value={form.eis_employer_rate ?? ''}
                onChange={(e) => set('eis_employer_rate', Number(e.target.value))}
                step="0.001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Employee Rate (%)</Label>
              <Input
                type="number"
                value={form.eis_employee_rate ?? ''}
                onChange={(e) => set('eis_employee_rate', Number(e.target.value))}
                step="0.001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wage Ceiling (RM)</Label>
              <Input
                type="number"
                value={form.eis_wage_ceiling ?? ''}
                onChange={(e) => set('eis_wage_ceiling', Number(e.target.value))}
                step="100"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">HRDC</h4>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.hrdc_enabled ?? true}
                onCheckedChange={(v) => set('hrdc_enabled', v)}
              />
              <Label className="text-xs">Enabled</Label>
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Rate (%)</Label>
              <Input
                type="number"
                value={form.hrdc_rate ?? ''}
                onChange={(e) => set('hrdc_rate', Number(e.target.value))}
                step="0.001"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">General</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Working Days / Month</Label>
              <Input
                type="number"
                value={form.working_days_per_month ?? 26}
                onChange={(e) => set('working_days_per_month', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payroll Cutoff Day</Label>
              <Input
                type="number"
                value={form.payroll_cutoff_day ?? 25}
                onChange={(e) => set('payroll_cutoff_day', Number(e.target.value))}
                min="1"
                max="31"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Memo</h4>
          <div className="space-y-1">
            <Label className="text-xs">Memo Number Prefix</Label>
            <Input
              value={form.memo_number_prefix ?? 'MEMO'}
              onChange={(e) => set('memo_number_prefix', e.target.value)}
              placeholder="e.g. MEMO, TIDAL/MEMO"
            />
            <p className="text-xs text-muted-foreground">
              Generated as: {form.memo_number_prefix || 'MEMO'}-2026-03
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Payslip</h4>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.show_allowance_on_payslip ?? false}
              onCheckedChange={(v) => set('show_allowance_on_payslip', v)}
            />
            <Label className="text-xs">Show allowance on payslip</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            When disabled, allowances are excluded from the payslip PDF but still included in net pay.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
