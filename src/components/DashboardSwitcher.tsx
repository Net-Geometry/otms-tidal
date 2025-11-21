import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveRole } from '@/hooks/useActiveRole';
import { AppRole } from '@/types/otms';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface DashboardOption {
  role: AppRole;
  label: string;
  path: string;
  icon?: string;
}

const DASHBOARD_ROUTES: DashboardOption[] = [
  { role: 'admin', label: 'Admin Dashboard', path: '/admin/dashboard' },
  { role: 'hr', label: 'HR Dashboard', path: '/hr/dashboard' },
  { role: 'management', label: 'Management Dashboard', path: '/management/dashboard' },
  { role: 'supervisor', label: 'Supervisor Dashboard', path: '/supervisor/dashboard' },
  { role: 'employee', label: 'Employee Dashboard', path: '/employee/dashboard' },
];

const STORAGE_KEY = 'preferred_dashboard';

export function DashboardSwitcher() {
  const { roles } = useAuth();
  const { activeRole, setActiveRole } = useActiveRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [preferredDashboard, setPreferredDashboard] = useState<string | null>(null);

  // Load preferred dashboard from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPreferredDashboard(stored);
    }
  }, []);

  // Get accessible dashboards for user
  const accessibleDashboards = useCallback((): DashboardOption[] => {
    return DASHBOARD_ROUTES.filter((option) => roles.includes(option.role));
  }, [roles]);

  // Get current dashboard option
  const currentDashboard = useCallback((): DashboardOption | null => {
    const accessible = accessibleDashboards();

    // If user has preferred dashboard and it's still accessible, use it
    if (preferredDashboard) {
      const preferred = accessible.find((d) => d.path === preferredDashboard);
      if (preferred) {
        return preferred;
      }
    }

    // Otherwise find based on current route
    return accessible.find((d) => location.pathname.includes(d.path)) || accessible[0] || null;
  }, [accessibleDashboards, preferredDashboard, location.pathname]);

  const handleSwitchDashboard = (path: string, role: AppRole) => {
    localStorage.setItem(STORAGE_KEY, path);
    setPreferredDashboard(path);
    setActiveRole(role); // Set the active role when switching dashboard
    navigate(path);
  };

  const accessible = accessibleDashboards();
  const current = currentDashboard();

  // Only show switcher if user has multiple roles/dashboards
  if (accessible.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          title="Switch dashboard"
        >
          {current?.label || 'Dashboard'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Switch Dashboard
        </div>
        <DropdownMenuSeparator />
        {accessible.map((dashboard) => (
          <DropdownMenuItem
            key={dashboard.path}
            onClick={() => handleSwitchDashboard(dashboard.path, dashboard.role)}
            className={current?.path === dashboard.path ? 'bg-accent' : ''}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
              <span>{dashboard.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
