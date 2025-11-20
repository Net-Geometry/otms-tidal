import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppRole } from '@/types/otms';
import { useAuth } from './useAuth';

interface ActiveRoleContextType {
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | undefined>(undefined);

interface ActiveRoleProviderProps {
  children: ReactNode;
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

    // Determine default active role based on priority
    const roleOrder: AppRole[] = ['admin', 'hr', 'management', 'supervisor', 'employee'];
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
