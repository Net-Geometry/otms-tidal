import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Copy, Calculator } from 'lucide-react';
import { format } from 'date-fns';

interface RateFormula {
  id: string;
  formula_name: string;
  day_type: string;
  orp_definition?: string;
  hrp_definition?: string;
  multiplier: number;
  base_formula: string;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  employee_category: string;
}

interface FormulaCardProps {
  formula: RateFormula;
  onEdit: (formula: RateFormula) => void;
  onDelete: (formula: RateFormula) => void;
  onDuplicate: (formula: RateFormula) => void;
}

export function FormulaCard({ formula, onEdit, onDelete, onDuplicate }: FormulaCardProps) {
  const formatDayType = (dayType: string) => {
    return dayType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const buildFormulaExpression = () => {
    return `(${formula.base_formula}) × ${formula.multiplier} × Hours`;
  };

  return (
    <Card className="p-6 space-y-4">
      {/* Header Row */}
      <div className="flex justify-between items-center">
        <h4 className="text-base font-semibold text-foreground">
          {formula.formula_name}
        </h4>
        <Badge 
          variant={formula.is_active ? 'default' : 'secondary'}
          className={formula.is_active ? 'bg-[#E0E7FF] text-[#1E40AF]' : ''}
        >
          {formula.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Day Type & Category */}
      <p className="text-sm text-muted-foreground">
        {formatDayType(formula.day_type)} | {formula.employee_category}
      </p>

      {/* ORP & HRP Definitions */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">ORP:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">{formula.orp_definition || '(Basic / 26 / 8)'}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">HRP:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">{formula.hrp_definition || '(Basic / 26 / 8)'}</code>
        </div>
      </div>

      {/* Formula Expression Box */}
      <div className="bg-muted p-4 rounded-lg flex items-center gap-3">
        <Calculator className="h-5 w-5 text-primary flex-shrink-0" />
        <code className="text-sm font-mono text-foreground">
          {buildFormulaExpression()}
        </code>
      </div>

      {/* Effective Date */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Effective From:</span>
        <span className="font-semibold text-foreground">
          {format(new Date(formula.effective_from), 'dd MMM yyyy')}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDuplicate(formula)}
          title="Duplicate Formula"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(formula)}
          title="Edit Formula"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(formula)}
          title="Delete Formula"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
