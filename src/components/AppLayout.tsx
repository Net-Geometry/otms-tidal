import { ReactNode } from 'react';
import { useActiveRole } from '@/hooks/useActiveRole';

// Import layout variants
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { SupervisorLayout } from './layouts/SupervisorLayout';
import { HRLayout } from './layouts/HRLayout';
import { FinanceLayout } from './layouts/FinanceLayout';
import { ManagementLayout } from './layouts/ManagementLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { isFinanceRole } from '@/lib/financeRoles';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { activeRole } = useActiveRole();

  // Route determining logic: serve different layout components based on activeRole
  
  if (activeRole === 'admin') {
    return <AdminLayout activeRole={activeRole}>{children}</AdminLayout>;
  }

  if (activeRole === 'employee') {
    return <EmployeeLayout>{children}</EmployeeLayout>;
  }

  if (activeRole === 'supervisor') {
    return <SupervisorLayout>{children}</SupervisorLayout>;
  }

  if (activeRole === 'hr') {
    return <HRLayout activeRole={activeRole}>{children}</HRLayout>;
  }

  if (isFinanceRole(activeRole)) {
    return <FinanceLayout activeRole={activeRole}>{children}</FinanceLayout>;
  }

  if (['sgm', 'management', 'director', 'gm', 'dmd', 'assistant_manager', 'manager'].includes(activeRole || '')) {
    return <ManagementLayout activeRole={activeRole}>{children}</ManagementLayout>;
  }

  // Fallback layout (if no role is active but user is somehow logged in)
  // Revert gracefully to EmployeeLayout for minimal breakage
  return <EmployeeLayout>{children}</EmployeeLayout>;
}
