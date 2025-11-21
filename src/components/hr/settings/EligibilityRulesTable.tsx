import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';

interface EligibilityRule {
  id: string;
  rule_name: string;
  min_salary: number;
  max_salary: number;
  is_active: boolean;
  department_ids: string[];
  role_ids: string[];
  employment_types: string[];
}

interface EligibilityRulesTableProps {
  rules: EligibilityRule[];
  isLoading: boolean;
}

export function EligibilityRulesTable({ rules, isLoading }: EligibilityRulesTableProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No eligibility rules configured. Click "Add Rule" to create one.
      </div>
    );
  }

  return (
    <ResponsiveTable
      cardConfig={{
        data: rules,
        emptyMessage: 'No eligibility rules configured. Click "Add Rule" to create one.',
        render: (rule) => ({
          title: rule.rule_name,
          subtitle: `${formatCurrency(rule.min_salary)} - ${formatCurrency(rule.max_salary)}`,
          fields: [
            {
              label: 'Departments',
              value: rule.department_ids.length === 0 ? 'All' : `${rule.department_ids.length} depts`
            },
            {
              label: 'Roles',
              value: rule.role_ids.length === 0 ? 'All' : `${rule.role_ids.length} roles`
            },
            {
              label: 'Employment Types',
              value: rule.employment_types.length === 0 ? 'All' : rule.employment_types.join(', ')
            },
            {
              label: 'Status',
              value: <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                {rule.is_active ? 'Active' : 'Inactive'}
              </Badge>
            }
          ],
          actions: (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="h-9 w-9"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })
      }}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Salary Range</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Employment Types</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.rule_name}</TableCell>
                <TableCell>
                  {formatCurrency(rule.min_salary)} - {formatCurrency(rule.max_salary)}
                </TableCell>
                <TableCell>
                  {rule.department_ids.length === 0 ? (
                    <Badge variant="outline">All</Badge>
                  ) : (
                    <Badge variant="outline">{rule.department_ids.length} depts</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {rule.role_ids.length === 0 ? (
                    <Badge variant="outline">All</Badge>
                  ) : (
                    <Badge variant="outline">{rule.role_ids.length} roles</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {rule.employment_types.length === 0 ? (
                    <Badge variant="outline">All</Badge>
                  ) : (
                    rule.employment_types.join(', ')
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResponsiveTable>
  );
}
