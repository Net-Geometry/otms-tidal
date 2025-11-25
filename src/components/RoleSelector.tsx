import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { AppRole } from '@/types/otms';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const AVAILABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'employee', label: 'Employee', description: 'Can submit OT requests' },
  { value: 'supervisor', label: 'Supervisor', description: 'Can verify OT requests' },
  { value: 'hr', label: 'HR Manager', description: 'Can approve OT and manage system' },
  { value: 'management', label: 'Management', description: 'Can review OT reports' },
  { value: 'admin', label: 'Admin', description: 'Full system access' },
];

interface RoleSelectorProps {
  selectedRoles: AppRole[];
  onRolesChange: (roles: AppRole[]) => void;
  disabled?: boolean;
}

export function RoleSelector({
  selectedRoles,
  onRolesChange,
  disabled = false,
}: RoleSelectorProps) {
  const { validateRoleCombination } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempRoles, setTempRoles] = useState<AppRole[]>(selectedRoles);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleEditClick = () => {
    setTempRoles(selectedRoles);
    setValidationError(null);
    setIsDialogOpen(true);
  };

  const handleRoleToggle = (role: AppRole) => {
    setTempRoles((prev) => {
      const newRoles = prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role];

      // Validate the new combination
      const validation = validateRoleCombination(newRoles);
      setValidationError(validation.error || null);

      return newRoles;
    });
  };

  const handleSave = () => {
    const validation = validateRoleCombination(tempRoles);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid role combination');
      return;
    }

    onRolesChange(tempRoles);
    setIsDialogOpen(false);
  };

  const handleCancel = () => {
    setTempRoles(selectedRoles);
    setValidationError(null);
    setIsDialogOpen(false);
  };

  const getRoleBadgeColor = (role: AppRole): string => {
    const colors: Record<AppRole, string> = {
      employee: 'bg-blue-100 text-blue-800',
      supervisor: 'bg-green-100 text-green-800',
      hr: 'bg-purple-100 text-purple-800',
      management: 'bg-orange-100 text-orange-800',
      admin: 'bg-gray-800 text-white',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: AppRole): string => {
    const roleObj = AVAILABLE_ROLES.find((r) => r.value === role);
    return roleObj?.label || role;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {selectedRoles.length > 0 ? (
            selectedRoles.map((role) => (
              <Badge key={role} className={`${getRoleBadgeColor(role)} cursor-default`}>
                {getRoleLabel(role)}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-500">No roles assigned</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEditClick}
          disabled={disabled}
          className="ml-auto"
        >
          Edit Roles
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Roles</DialogTitle>
            <DialogDescription>
              Choose one or more roles for this employee. Admin cannot be combined with other
              roles.
            </DialogDescription>
          </DialogHeader>

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-3">
              {AVAILABLE_ROLES.map((roleOption) => (
                <div key={roleOption.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={roleOption.value}
                    checked={tempRoles.includes(roleOption.value)}
                    onCheckedChange={() => handleRoleToggle(roleOption.value)}
                    disabled={
                      // Disable other roles if admin is selected
                      (tempRoles.includes('admin') && roleOption.value !== 'admin') ||
                      // Disable admin if other roles are selected
                      (tempRoles.length > 0 && !tempRoles.includes('admin') && roleOption.value === 'admin')
                    }
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={roleOption.value}
                      className="font-medium cursor-pointer"
                    >
                      {roleOption.label}
                    </Label>
                    <p className="text-xs text-gray-500">{roleOption.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={validationError !== null}>
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
