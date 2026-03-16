import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppRole } from '@/types/otms';
import { getFirstFinanceRole, FINANCE_SPECIFIC_ROLES } from '@/lib/financeRoles';
import { useAuth } from './useAuth';

interface ActiveRoleContextType {
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | undefined>(undefined);

interface ActiveRoleProviderProps {
  children: ReactNode;
}

// Determine preferred role based on current URL path
function getPreferredRoleFromPath(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null;
  
  const path = window.location.pathname;
  
  // Map paths to preferred roles
  if (path.startsWith('/finance/')) {
    const finRole = getFirstFinanceRole(roles);
    if (finRole) return finRole;
  }
  if (path.startsWith('/hr/') && roles.includes('hr')) return 'hr';
  if (path.startsWith('/supervisor/') && roles.includes('supervisor')) return 'supervisor';
  if (path.startsWith('/management/')) {
    const mgmtRoles: AppRole[] = ['dmd', 'management', 'director', 'gm', 'sgm', 'assistant_manager', 'manager'];
    const mgmtRole = mgmtRoles.find(r => roles.includes(r));
    if (mgmtRole) return mgmtRole;
  }
  if (path.startsWith('/employee/') && roles.includes('employee')) return 'employee';
  if (path.startsWith('/admin/') && roles.includes('admin')) return 'admin';
  
  return null;
}

export function ActiveRoleProvider({ children }: ActiveRoleProviderProps) {
  const { roles } = useAuth();
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);

  // Initialize active role on mount or when roles change
  useEffect(() => {
    if (roles.length === 0) {
      setActiveRole(null);
      return;
    }

    // Check if current activeRole is still valid
    if (activeRole && roles.includes(activeRole)) {
      return; // Keep current role
    }

    // First, try to infer role from current path
    const pathRole = getPreferredRoleFromPath(roles);
    if (pathRole) {
      setActiveRole(pathRole);
      return;
    }

    // Fall back to default priority order
    const roleOrder: AppRole[] = [
      'admin', 'hr',
      ...FINANCE_SPECIFIC_ROLES, 'finance', 'head_finance',
      'dmd', 'sgm', 'management', 'director', 'gm', 'assistant_manager', 'manager',
      'supervisor', 'employee',
    ];
    const newActiveRole = roleOrder.find((role) => roles.includes(role)) || roles[0] || null;
    setActiveRole(newActiveRole);
  }, [roles, activeRole]);

  const value: ActiveRoleContextType = {
    activeRole,
    setActiveRole,
  };

  return (
    <ActiveRoleContext.Provider value={value}>{children}</ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (context === undefined) {
    throw new Error('useActiveRole must be used within an ActiveRoleProvider');
  }
  return context;
}
