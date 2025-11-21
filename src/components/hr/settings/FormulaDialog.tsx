import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCreateRateFormula } from '@/hooks/hr/useCreateRateFormula';
import { useUpdateRateFormula } from '@/hooks/hr/useUpdateRateFormula';
import { validateFormulaSyntax, evaluateFormula } from '@/lib/formulaValidator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormDescription } from '@/components/ui/form';

const formulaSchema = z.object({
  formula_name: z.string().min(1, 'Formula name is required').max(100),
  day_type: z.enum(['weekday', 'saturday', 'sunday', 'public_holiday']),
  orp_definition: z.string().min(1, 'ORP definition is required'),
  hrp_definition: z.string().min(1, 'HRP definition is required'),
  multiplier: z.coerce.number().min(0, 'Multiplier must be positive'),
  base_formula: z.string().min(1, 'Base formula is required'),
  is_active: z.boolean().default(true),
  effective_from: z.string().min(1, 'Effective date is required'),
});

type FormulaFormValues = z.infer<typeof formulaSchema>;

interface FormulaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula?: any;
  onSuccess?: () => void;
}

export function FormulaDialog({ open, onOpenChange, formula, onSuccess }: FormulaDialogProps) {
  const isEditing = !!formula;
  const createFormula = useCreateRateFormula();
  const updateFormula = useUpdateRateFormula();
  
  const [formulaValidation, setFormulaValidation] = useState<{ isValid: boolean; errors: string[] }>({ isValid: true, errors: [] });
  const [previewBasicSalary, setPreviewBasicSalary] = useState<string>('3000');
  const [previewHours, setPreviewHours] = useState<string>('4');
  const [previewResult, setPreviewResult] = useState<any>(null);

  const form = useForm<FormulaFormValues>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      formula_name: '',
      day_type: 'weekday',
      orp_definition: '(Basic / 26 / 8)',
      hrp_definition: '(Basic / 26 / 8)',
      multiplier: 1.5,
      base_formula: 'HRP * Hours',
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (formula) {
      form.reset({
        formula_name: formula.formula_name,
        day_type: formula.day_type,
        orp_definition: formula.orp_definition || '(Basic / 26 / 8)',
        hrp_definition: formula.hrp_definition || '(Basic / 26 / 8)',
        multiplier: formula.multiplier,
        base_formula: formula.base_formula,
        is_active: formula.is_active,
        effective_from: formula.effective_from,
      });
    } else {
      form.reset({
        formula_name: '',
        day_type: 'weekday',
        orp_definition: '(Basic / 26 / 8)',
        hrp_definition: '(Basic / 26 / 8)',
        multiplier: 1.5,
        base_formula: 'ORP',
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0],
      });
    }
  }, [formula, form]);

  const onSubmit = async (data: FormulaFormValues) => {
    if (isEditing) {
      updateFormula.mutate(
        { id: formula.id, ...data },
        {
          onSuccess: () => {
            onSuccess?.();
            handleClose();
          },
        }
      );
    } else {
      createFormula.mutate(
        {
          formula_name: data.formula_name,
          day_type: data.day_type,
          orp_definition: data.orp_definition,
          hrp_definition: data.hrp_definition,
          multiplier: data.multiplier,
          base_formula: data.base_formula,
          is_active: data.is_active,
          effective_from: data.effective_from,
        },
        {
          onSuccess: () => {
            onSuccess?.();
            handleClose();
          },
        }
      );
    }
  };

  const handleClose = () => {
    form.reset();
    setFormulaValidation({ isValid: true, errors: [] });
    setPreviewResult(null);
    onOpenChange(false);
  };

  const handleFormulaValidation = (value: string) => {
    const validation = validateFormulaSyntax(value);
    setFormulaValidation(validation);
  };

  const handlePreview = () => {
    const baseFormula = form.getValues('base_formula');
    const multiplier = form.getValues('multiplier');
    const basicSalary = parseFloat(previewBasicSalary);
    const hours = parseFloat(previewHours);

    if (!basicSalary || !hours || basicSalary <= 0 || hours <= 0) {
      setPreviewResult({ error: 'Please enter valid positive numbers for salary and hours' });
      return;
    }

    try {
      const result = evaluateFormula(baseFormula, basicSalary, hours, multiplier);
      setPreviewResult(result);
    } catch (e: any) {
      setPreviewResult({ error: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rate Formula' : 'Add Rate Formula'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the rate formula details below.'
              : 'Create a new rate formula for OT calculations.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="formula_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formula Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Standard Weekday OT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="day_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekday">Weekday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                        <SelectItem value="public_holiday">Public Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Multiplier *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effective_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable this formula
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

              {/* ORP Definition Field */}
              <FormField
                control={form.control}
                name="orp_definition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ORP (Ordinary Rate of Pay) Definition *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Basic / 26 / 8"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Define how ORP is calculated. Default: (Basic / 26 / 8)
                      <br />Common variations: Basic / 26, Basic / 22
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* HRP Definition Field */}
              <FormField
                control={form.control}
                name="hrp_definition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HRP (Hourly Rate of Pay) Definition *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., ORP / 8 or Basic / 26 / 8"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Define how HRP is calculated. Can reference ORP.
                      <br />Common options: ORP / 8, Basic / 26 / 8, (Basic / 26) / 8
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="base_formula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Formula *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., HRP * Hours or IF(Hours <= 4, 0.5 * ORP, 1 * ORP)"
                      className="min-h-[100px]"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        handleFormulaValidation(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Allowed variables: Hours, ORP, HRP, Basic. Use IF(condition, true_value, false_value) for conditional logic.
                  </FormDescription>
                  {!formulaValidation.isValid && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {formulaValidation.errors.map((err, idx) => (
                          <div key={idx}>{err}</div>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                  {formulaValidation.isValid && field.value && (
                    <Alert className="mt-2 border-green-500 bg-green-50 dark:bg-green-950">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Formula syntax is valid
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Formula Preview Section */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Formula Preview & Testing</CardTitle>
                <CardDescription>Test your formula with sample values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preview-salary">Sample Basic Salary (RM)</Label>
                    <Input
                      id="preview-salary"
                      type="number"
                      value={previewBasicSalary}
                      onChange={(e) => setPreviewBasicSalary(e.target.value)}
                      placeholder="3000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preview-hours">Sample Hours Worked</Label>
                    <Input
                      id="preview-hours"
                      type="number"
                      step="0.5"
                      value={previewHours}
                      onChange={(e) => setPreviewHours(e.target.value)}
                      placeholder="4"
                    />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={handlePreview} className="w-full">
                  Preview Result
                </Button>
                {previewResult && (
                  <div className="mt-4">
                    {previewResult.error ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{previewResult.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <AlertDescription>
                          <div className="space-y-1 text-sm whitespace-pre-line font-mono text-blue-800 dark:text-blue-200">
                            {previewResult.breakdown}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#5F26B4] hover:bg-[#5F26B4]/90"
                disabled={createFormula.isPending || updateFormula.isPending}
              >
                {createFormula.isPending || updateFormula.isPending
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Formula'
                  : 'Create Formula'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
