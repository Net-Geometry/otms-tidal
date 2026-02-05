import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Profile, AppRole } from '@/types/otms';
import { useUpdateEmployee } from '@/hooks/hr/useUpdateEmployee';
import { useDepartments } from '@/hooks/hr/useDepartments';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { usePositions } from '@/hooks/hr/usePositions';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useCompanyLocations } from '@/hooks/hr/useCompanyLocations';
import { useResetEmployeePassword } from '@/hooks/hr/useResetEmployeePassword';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/otCalculations';
import { KeyRound, AlertTriangle, Copy, Check } from 'lucide-react';
import { RoleSelector } from '@/components/RoleSelector';
import { StateSelector } from '@/components/hr/StateSelector';

interface EmployeeDetailsSheetProps {
  employee: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'view' | 'edit';
}

const employmentTypes = ['Permanent', 'Contract', 'Internship'];
const statuses = ['active', 'inactive'];

export function EmployeeDetailsSheet({
  employee,
  open,
  onOpenChange,
  mode: initialMode,
}: EmployeeDetailsSheetProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [showResetCodeDialog, setShowResetCodeDialog] = useState(false);
  const [resetCodeData, setResetCodeData] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { hasRole } = useAuth();
  const updateEmployee = useUpdateEmployee();
  const resetPassword = useResetEmployeePassword();
  const { data: companies } = useCompanies();
  const { data: departments } = useDepartments();
  const { data: employees = [] } = useEmployees();
  const { data: positions = [], isLoading: isLoadingPositions } = usePositions(formData.department_id || undefined);
  const { data: locations = [] } = useCompanyLocations();

  const isAdmin = hasRole('admin');

  // Determine if supervisor is required based on selected roles
  const supervisorRequired = !selectedRoles.some(role => ['admin', 'management'].includes(role));

  // Validation error for supervisor_id
  const [supervisorValidationError, setSupervisorValidationError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (employee) {
      setFormData(employee);
      setSelectedRoles(
        employee.user_roles && employee.user_roles.length > 0
          ? employee.user_roles.map((r) => r.role)
          : []
      );
    }
  }, [employee]);

  if (!employee) return null;

  const handleSave = () => {
    // Validate supervisor_id is required for non-admin/management roles
    if (supervisorRequired && !formData.supervisor_id) {
      setSupervisorValidationError('Reporting To is required for this role');
      return;
    }

    setSupervisorValidationError(null);

    // Get position title from selected position
    const selectedPosition = positions.find(p => p.id === formData.position_id);
    const positionTitle = selectedPosition?.title || formData.position || '';

    updateEmployee.mutate(
      {
        id: employee.id,
        ...formData,
        position: positionTitle,
        roles: selectedRoles,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    setFormData(employee);
    setMode('view');
  };

  const handleResetPassword = () => {
    resetPassword.mutate(
      {
        employeeId: employee.id,
      },
      {
        onSuccess: (data) => {
          setResetCodeData({
            code: data.resetCode,
            expiresAt: data.expiresAt,
          });
          setShowResetCodeDialog(true);
        },
      }
    );
  };

  const handleCopyCode = () => {
    if (resetCodeData?.code) {
      navigator.clipboard.writeText(resetCodeData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isEditing = mode === 'edit';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Employee Details</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Edit employee information' : 'View employee information'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1: Employee No + Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="employee_id">Employee No</Label>
              {isEditing && isAdmin ? (
                <div className="space-y-2">
                  <Input
                    id="employee_id"
                    value={formData.employee_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, employee_id: e.target.value })
                    }
                    placeholder="Enter Employee No"
                    className="font-mono"
                  />
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Admin only: Changing Employee ID may affect payroll and historical records. Use with caution.</span>
                  </div>
                </div>
              ) : (
                <div className="font-mono text-sm font-semibold bg-muted/50 p-2 rounded">
                  {employee.employee_id}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              {isEditing ? (
                <Input
                  id="full_name"
                  value={formData.full_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="Enter Full Name"
                  required
                />
              ) : (
                <div className="text-sm">{employee.full_name}</div>
              )}
            </div>

            {/* Row 2: IC/Passport No + Email */}
            <div className="grid gap-2">
              <Label htmlFor="ic_no">IC/Passport No</Label>
              {isEditing ? (
                <Input
                  id="ic_no"
                  value={formData.ic_no || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ic_no: e.target.value })
                  }
                  placeholder="e.g. 900101-10-1234"
                />
              ) : (
                <div className="text-sm">{employee.ic_no || '-'}</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter Email"
                  required
                />
              ) : (
                <div className="text-sm">{employee.email}</div>
              )}
            </div>

            {/* Row 3: Phone No + Company */}
            <div className="grid gap-2">
              <Label htmlFor="phone_no">Phone No</Label>
              {isEditing ? (
                <Input
                  id="phone_no"
                  value={formData.phone_no || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_no: e.target.value })
                  }
                  placeholder="e.g. 012-3456789"
                />
              ) : (
                <div className="text-sm">{employee.phone_no || '-'}</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              {isEditing ? (
                <Select
                  value={formData.company_id || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, company_id: value })
                  }
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">
                  {companies?.find((c) => c.id === employee.company_id)?.name || '-'}
                </div>
              )}
            </div>

            {/* Row 4: Department + Position */}
            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              {isEditing ? (
                <Select
                  value={formData.department_id || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department_id: value })
                  }
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">
                  {departments?.find((d) => d.id === employee.department_id)?.name || '-'}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="position">Position</Label>
              {isEditing ? (
                <Select
                  value={formData.position_id || undefined}
                  onValueChange={(value) => {
                    const selectedPosition = positions.find(p => p.id === value);
                    setFormData({
                      ...formData,
                      position_id: value,
                      position: selectedPosition?.title || ''
                    });
                  }}
                  disabled={!formData.department_id}
                >
                  <SelectTrigger id="position">
                    <SelectValue placeholder={!formData.department_id ? "Select department first" : "Select position"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPositions ? (
                      <SelectItem value="loading" disabled>Loading positions...</SelectItem>
                    ) : positions.length > 0 ? (
                      positions
                        .filter(p => p.is_active)
                        .map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.title}
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="no-positions" disabled>
                        No positions found for this department
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">{employee.position || '-'}</div>
              )}
            </div>

            {/* Row 5: Basic Salary + OT Base Salary */}
            <div className="grid gap-2">
              <Label htmlFor="basic_salary">Basic Salary (RM)</Label>
              {isEditing ? (
                <Input
                  id="basic_salary"
                  type="number"
                  step="0.01"
                  value={formData.basic_salary || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      basic_salary: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. 3000"
                  required
                />
              ) : (
                <div className="text-sm">{formatCurrency(employee.basic_salary)}</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ot_base">OT Base Salary (RM)</Label>
              {isEditing ? (
                <div className="space-y-1">
                  <Input
                    id="ot_base"
                    type="number"
                    step="0.01"
                    value={formData.ot_base || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ot_base: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="Uses Basic Salary if empty"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional override for OT calculations
                  </p>
                </div>
              ) : (
                <div className="text-sm">
                  {employee.ot_base ? formatCurrency(employee.ot_base) : (
                    <span className="text-muted-foreground">Using Basic Salary</span>
                  )}
                </div>
              )}
            </div>

            {/* Row 6: Employment Type + Joining Date */}
            <div className="grid gap-2">
              <Label htmlFor="employment_type">Employment Type</Label>
              {isEditing ? (
                <Select
                  value={formData.employment_type || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, employment_type: value })
                  }
                >
                  <SelectTrigger id="employment_type">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">{employee.employment_type || '-'}</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="joining_date">Joining Date</Label>
              {isEditing ? (
                <Input
                  id="joining_date"
                  type="date"
                  value={formData.joining_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, joining_date: e.target.value })
                  }
                />
              ) : (
                <div className="text-sm">{employee.joining_date || '-'}</div>
              )}
            </div>

            {/* Row 7: Work Location */}
            <div className="grid gap-2">
              <Label htmlFor="work_location">Work Location</Label>
              {isEditing ? (
                <Select
                  value={formData.work_location || ''}
                  onValueChange={(value) => {
                    setFormData({ ...formData, work_location: value });
                    // Auto-set state from location's state_code
                    const location = locations.find(loc => loc.id === value);
                    if (location) {
                      setFormData(prev => ({ ...prev, state: location.state_code }));
                    }
                  }}
                >
                  <SelectTrigger id="work_location">
                    <SelectValue placeholder="Select Work Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.location_name} ({location.state_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">
                  {locations.find((loc) => loc.id === employee.work_location)?.location_name || '-'}
                  {employee.work_location && locations.find((loc) => loc.id === employee.work_location) && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {locations.find((loc) => loc.id === employee.work_location)?.state_code}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Row 9: Reporting To (Full Width) */}
            <div className="grid gap-2">
              <Label htmlFor="supervisor_id">
                Reporting To {supervisorRequired ? '*' : ''}
              </Label>
              {isEditing ? (
                <>
                  <Select
                    value={formData.supervisor_id || undefined}
                    onValueChange={(value) => {
                      setFormData({ ...formData, supervisor_id: value });
                      setSupervisorValidationError(null);
                    }}
                  >
                    <SelectTrigger id="supervisor_id" className={supervisorValidationError ? 'border-red-500' : ''}>
                      <SelectValue placeholder={supervisorRequired ? "Select Supervisor (Required)" : "Select Supervisor (Optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter(emp => emp.user_roles?.some(r => ['supervisor', 'hr', 'admin'].includes(r.role)))
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {supervisorValidationError && (
                    <p className="text-sm text-red-500">{supervisorValidationError}</p>
                  )}
                </>
              ) : (
                <div className="text-sm">
                  {employees.find((e) => e.id === employee.supervisor_id)?.full_name || '-'}
                </div>
              )}
            </div>

            {/* Row 10: Role + Status */}
            <div className="grid gap-2">
              <Label htmlFor="role">Roles</Label>
              {isEditing ? (
                <RoleSelector
                  selectedRoles={selectedRoles}
                  onRolesChange={setSelectedRoles}
                  disabled={false}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedRoles.length > 0 ? (
                    selectedRoles.map((role) => (
                      <Badge key={role} variant="outline" className="capitalize">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No roles assigned</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              {isEditing ? (
                <Select
                  value={formData.status || 'active'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant={employee.status === 'active' ? 'default' : 'secondary'}
                  className="w-fit"
                >
                  {employee.status}
                </Badge>
              )}
            </div>

            {/* Row 10: OT Eligible (Full Width) */}
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="is_ot_eligible">OT Eligible</Label>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_ot_eligible"
                    checked={formData.is_ot_eligible ?? true}
                    onChange={(e) =>
                      setFormData({ ...formData, is_ot_eligible: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Allow employee to submit overtime requests
                  </span>
                </div>
              ) : (
                <Badge variant={employee.is_ot_eligible ? 'default' : 'secondary'} className="w-fit">
                  {employee.is_ot_eligible ? 'Yes' : 'No'}
                </Badge>
              )}
            </div>

            {/* Row 11: Require OT Attachment (Full Width) */}
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="require_ot_attachment">Require OT Attachment</Label>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="require_ot_attachment"
                    checked={formData.require_ot_attachment ?? false}
                    onChange={(e) =>
                      setFormData({ ...formData, require_ot_attachment: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Require employee to attach files when submitting OT requests
                  </span>
                </div>
              ) : (
                <Badge variant={employee.require_ot_attachment ? 'default' : 'secondary'} className="w-fit">
                  {employee.require_ot_attachment ? 'Required' : 'Optional'}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateEmployee.isPending}>
                  {updateEmployee.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleResetPassword}
                  disabled={resetPassword.isPending}
                  className="gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  {resetPassword.isPending ? 'Sending...' : 'Reset Password'}
                </Button>
                <Button onClick={() => setMode('edit')}>Edit</Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Reset Code Dialog */}
      <Dialog open={showResetCodeDialog} onOpenChange={setShowResetCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset Code</DialogTitle>
            <DialogDescription>
              Share this code with {employee?.full_name} so they can reset their password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Reset Code Display */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Reset Code</div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-2xl font-mono font-bold tracking-widest">
                  {resetCodeData?.code}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Expiration Info */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Expires:</strong> {resetCodeData?.expiresAt ? new Date(resetCodeData.expiresAt).toLocaleString() : 'Unknown'}
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The employee will need to:
              </p>
              <ol className="text-sm list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Navigate to the password reset page</li>
                <li>Enter the reset code above</li>
                <li>Set a new password</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowResetCodeDialog(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
