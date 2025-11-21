import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useInviteEmployee } from '@/hooks/hr/useInviteEmployee';
import { useDepartments } from '@/hooks/hr/useDepartments';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { usePositions } from '@/hooks/hr/usePositions';
import { useCompanies } from '@/hooks/hr/useCompanies';

const inviteSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  full_name: z.string().trim().min(1, 'Full name is required').max(100),
  employee_id: z.string().trim().min(1, 'Employee No is required').max(50),
  ic_no: z.string().trim().max(50).optional(),
  phone_no: z.string().trim().max(20).optional(),
  company_id: z.string().uuid('Company is required'),
  position_id: z.string().uuid('Position is required'),
  department_id: z.string().uuid('Department is required'),
  basic_salary: z.number().min(1, 'Basic salary must be greater than 0'),
  employment_type: z.string().min(1, 'Employment type is required'),
  joining_date: z.string().min(1, 'Joining date is required'),
  work_location: z.string().trim().min(1, 'Work location is required').max(100),
  supervisor_id: z.string().uuid().optional().or(z.literal('')),
  role: z.enum(['employee', 'supervisor', 'hr', 'management', 'admin']),
  is_ot_eligible: z.boolean().default(true),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteEmployeeDialog({ open, onOpenChange }: InviteEmployeeDialogProps) {
  const { mutate: inviteEmployee, isPending } = useInviteEmployee();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees();
  
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: 'employee',
      employment_type: 'Permanent',
      supervisor_id: '',
      is_ot_eligible: true,
    },
  });

  // Watch department_id to filter positions
  const selectedDepartmentId = form.watch('department_id');
  const { data: positions = [], isLoading: isLoadingPositions } = usePositions(selectedDepartmentId || undefined);

  // Reset position when department changes
  const previousDepartmentId = form.watch('department_id');
  if (previousDepartmentId !== selectedDepartmentId && form.getValues('position_id')) {
    form.setValue('position_id', '');
  }

  const onSubmit = (data: InviteFormData) => {
    // Get position title from selected position
    const selectedPosition = positions.find(p => p.id === data.position_id);
    const positionTitle = selectedPosition?.title || '';

    inviteEmployee({
      email: data.email || null,
      full_name: data.full_name,
      employee_id: data.employee_id,
      ic_no: data.ic_no || null,
      phone_no: data.phone_no || null,
      position: positionTitle,
      position_id: data.position_id,
      company_id: data.company_id,
      department_id: data.department_id,
      basic_salary: data.basic_salary,
      employment_type: data.employment_type,
      joining_date: data.joining_date,
      work_location: data.work_location,
      supervisor_id: data.supervisor_id || null,
      role: data.role,
      is_ot_eligible: data.is_ot_eligible,
    }, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Employee No & Full Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee No *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. EMP001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: IC/Passport & Email */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ic_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IC/Passport No</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 900101-10-1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g. employee@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Company (Full Width) */}
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 4: Department & Position */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position *</FormLabel>
                    <Select 
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedDepartmentId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedDepartmentId ? "Select department first" : "Select position"} />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Phone No & Basic Salary */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone No</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 012-3456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="basic_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary (RM) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 3000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6: Employment Type & Joining Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Permanent">Permanent</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="joining_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="work_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Location *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HQ, Site A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 9: Reporting To (Full Width) */}
            <FormField
              control={form.control}
              name="supervisor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reporting To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Supervisor (Optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees
                        .filter(emp => emp.user_roles?.some(r => ['supervisor', 'hr', 'management', 'admin'].includes(r.role)))
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_id})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 10: Role (Full Width) */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 11: OT Eligible */}
            <FormField
              control={form.control}
              name="is_ot_eligible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>OT Eligible</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Allow this employee to submit overtime requests
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add Employee'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
