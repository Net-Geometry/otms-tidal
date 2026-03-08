import { useMemo, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDepartments } from '@/hooks/hr/useDepartments';
import { usePositions } from '@/hooks/hr/usePositions';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { Building2, Users, User, ChevronDown, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { Profile } from '@/types/otms';

interface OrgNodeProps {
  label: string;
  sublabel?: string;
  count?: number;
  icon: React.ReactNode;
  variant: 'company' | 'department' | 'position' | 'employee';
  isCollapsed?: boolean;
  onToggle?: () => void;
  hasChildren?: boolean;
}

function OrgNode({ label, sublabel, count, icon, variant, isCollapsed, onToggle, hasChildren }: OrgNodeProps) {
  const variantStyles = {
    company: 'border-primary/30 bg-primary/5 shadow-md',
    department: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40',
    position: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
    employee: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40',
  };

  const iconBgStyles = {
    company: 'bg-primary/10 text-primary',
    department: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    position: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    employee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  };

  return (
    <div className="inline-flex flex-col items-center">
      <Card
        className={`inline-flex items-center gap-2.5 px-4 py-2.5 border-2 cursor-default transition-all hover:shadow-md ${variantStyles[variant]}`}
        onClick={hasChildren ? onToggle : undefined}
        style={hasChildren ? { cursor: 'pointer' } : undefined}
      >
        <div className={`flex-shrink-0 p-1.5 rounded-lg ${iconBgStyles[variant]}`}>
          {icon}
        </div>
        <div className="text-left min-w-0">
          <div className="font-semibold text-sm leading-tight truncate max-w-[180px]">{label}</div>
          {sublabel && (
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{sublabel}</div>
          )}
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs tabular-nums">
            {count}
          </Badge>
        )}
        {hasChildren && (
          <span className="ml-0.5 text-muted-foreground">
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </Card>
    </div>
  );
}

interface DeptNode {
  id: string;
  name: string;
  code: string;
  positions: { id: string; title: string; employees: Profile[] }[];
  employeeCount: number;
}

export default function OrgChart() {
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: positions, isLoading: loadingPos } = usePositions();
  const { data: employees, isLoading: loadingEmp } = useEmployees();

  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(100);

  const isLoading = loadingCompanies || loadingDepts || loadingPos || loadingEmp;

  const toggleNode = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build hierarchy: Company → Department → Position → Employee
  const orgData = useMemo(() => {
    if (!departments || !positions || !employees) return [];

    const filteredEmployees = selectedCompany === 'all'
      ? employees
      : employees.filter((e) => e.company_id === selectedCompany);

    const deptMap = new Map<string, DeptNode>();

    for (const dept of departments) {
      deptMap.set(dept.id, {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        positions: [],
        employeeCount: 0,
      });
    }

    // Group positions under departments
    for (const pos of positions) {
      const dept = deptMap.get(pos.department_id);
      if (dept) {
        const posEmployees = filteredEmployees.filter((e) => e.position_id === pos.id);
        dept.positions.push({
          id: pos.id,
          title: pos.title,
          employees: posEmployees,
        });
        dept.employeeCount += posEmployees.length;
      }
    }

    // Also include employees with department but no position
    for (const dept of deptMap.values()) {
      const unassigned = filteredEmployees.filter(
        (e) => e.department_id === dept.id && !e.position_id
      );
      if (unassigned.length > 0) {
        dept.positions.push({
          id: `unassigned-${dept.id}`,
          title: 'Unassigned',
          employees: unassigned,
        });
        dept.employeeCount += unassigned.length;
      }
      // Sort positions: named first, unassigned last
      dept.positions.sort((a, b) => {
        if (a.title === 'Unassigned') return 1;
        if (b.title === 'Unassigned') return -1;
        return a.title.localeCompare(b.title);
      });
    }

    // Filter out empty departments
    return Array.from(deptMap.values())
      .filter((d) => d.employeeCount > 0 || d.positions.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, positions, employees, selectedCompany]);

  const companyName = selectedCompany === 'all'
    ? 'All Companies'
    : companies?.find((c) => c.id === selectedCompany)?.name || 'Company';

  const totalEmployees = orgData.reduce((sum, d) => sum + d.employeeCount, 0);

  return (
    <AppLayout>
      <PageLayout
        title="Organization Chart"
        description="Visual hierarchy of departments, positions, and employees"
      >
        {/* Controls */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Company:</span>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm tabular-nums w-12 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(150, z + 10))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 ml-1" onClick={() => setZoom(100)}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span>{orgData.length} departments</span>
              <span>{totalEmployees} employees</span>
            </div>
          </div>
        </Card>

        {/* Org Chart */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Skeleton className="h-64 w-96" />
          </div>
        ) : orgData.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            No organizational data to display. Ensure employees are assigned to departments.
          </Card>
        ) : (
          <div className="overflow-auto rounded-lg border bg-card p-8">
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', minWidth: 'max-content' }}
            >
              <Tree
                lineWidth="2px"
                lineColor="hsl(var(--border))"
                lineBorderRadius="8px"
                nodePadding="8px"
                label={
                  <OrgNode
                    label={companyName}
                    count={totalEmployees}
                    icon={<Building2 className="h-5 w-5" />}
                    variant="company"
                    hasChildren={orgData.length > 0}
                    isCollapsed={collapsedNodes.has('root')}
                    onToggle={() => toggleNode('root')}
                  />
                }
              >
                {!collapsedNodes.has('root') && orgData.map((dept) => (
                  <TreeNode
                    key={dept.id}
                    label={
                      <OrgNode
                        label={dept.name}
                        sublabel={dept.code}
                        count={dept.employeeCount}
                        icon={<Users className="h-4 w-4" />}
                        variant="department"
                        hasChildren={dept.positions.length > 0}
                        isCollapsed={collapsedNodes.has(dept.id)}
                        onToggle={() => toggleNode(dept.id)}
                      />
                    }
                  >
                    {!collapsedNodes.has(dept.id) && dept.positions.map((pos) => (
                      <TreeNode
                        key={pos.id}
                        label={
                          <OrgNode
                            label={pos.title}
                            count={pos.employees.length}
                            icon={<User className="h-4 w-4" />}
                            variant="position"
                            hasChildren={pos.employees.length > 0}
                            isCollapsed={collapsedNodes.has(pos.id)}
                            onToggle={() => toggleNode(pos.id)}
                          />
                        }
                      >
                        {!collapsedNodes.has(pos.id) && pos.employees.map((emp) => (
                          <TreeNode
                            key={emp.id}
                            label={
                              <OrgNode
                                label={emp.full_name}
                                sublabel={emp.designation || emp.position || undefined}
                                icon={<User className="h-4 w-4" />}
                                variant="employee"
                              />
                            }
                          />
                        ))}
                      </TreeNode>
                    ))}
                  </TreeNode>
                ))}
              </Tree>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border-2 border-primary/30 bg-primary/5" />
            Company
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border-2 border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40" />
            Department
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40" />
            Position
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border-2 border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40" />
            Employee
          </div>
        </div>
      </PageLayout>
    </AppLayout>
  );
}
