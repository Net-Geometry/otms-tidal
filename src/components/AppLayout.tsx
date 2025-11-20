import { ReactNode, useState } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveRole } from '@/hooks/useActiveRole';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import tidalLogo from '@/assets/tidal-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { DashboardSwitcher } from '@/components/DashboardSwitcher';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  CheckCircle, 
  Users, 
  Building2,
  Settings, 
  FileText,
  Eye,
  User,
  LogOut,
  Calendar,
  Home
} from 'lucide-react';
import { AppRole } from '@/types/otms';

interface AppLayoutProps {
  children: ReactNode;
}

interface AppSidebarProps {
  activeRole: string | null;
}

function AppSidebar({ activeRole }: AppSidebarProps) {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  // State for collapsible groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dashboards: false,
    otManagement: false,
    hrManagement: false,
    reports: false,
    general: true, // open by default
  });

  // Determine which group contains the active route
  const getActiveGroup = () => {
    if (currentPath.includes('/dashboard')) return 'dashboards';
    if (currentPath.includes('/ot/') || currentPath.includes('/verify') || 
        currentPath.includes('/approve') || currentPath.includes('/certify')) return 'otManagement';
    if (currentPath.includes('/employees') || currentPath.includes('/departments')) return 'hrManagement';
    if (currentPath.includes('/report')) return 'reports';
    return 'general';
  };

  // Organized menu groups
  const menuGroups = {
    dashboards: {
      label: 'Dashboards',
      items: [
        { path: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, roles: ['admin'] },
        { path: '/hr/dashboard', label: 'HR Dashboard', icon: LayoutDashboard, roles: ['hr', 'admin'] },
        { path: '/supervisor/dashboard', label: 'Supervisor Dashboard', icon: LayoutDashboard, roles: ['supervisor'] },
        { path: '/employee/dashboard', label: 'Employee Dashboard', icon: LayoutDashboard, roles: ['employee'] },
        { path: '/management/dashboard', label: 'Management Dashboard', icon: LayoutDashboard, roles: ['management', 'admin'] },
      ],
    },
    otManagement: {
      label: 'OT Management',
      items: [
        { path: '/ot/submit', label: 'Submit OT', icon: PlusCircle, roles: ['employee'] },
        { path: '/ot/history', label: 'OT History', icon: History, roles: ['employee'] },
        { path: '/supervisor/verify', label: 'Verify OT', icon: CheckCircle, roles: ['supervisor'] },
        { path: '/hr/approve', label: 'Certify OT', icon: CheckCircle, roles: ['hr', 'admin'] },
        { path: '/management/approve', label: 'Approve OT', icon: CheckCircle, roles: ['management', 'admin'] },
      ],
    },
    hrManagement: {
      label: 'HR Management',
      items: [
        { path: '/hr/employees', label: 'Employees', icon: Users, roles: ['hr', 'admin'] },
        { path: '/hr/departments', label: 'Departments', icon: Building2, roles: ['hr', 'admin'] },
      ],
    },
    reports: {
      label: 'Reports',
      items: [
        { path: '/hr/ot-reports', label: 'OT Reports', icon: FileText, roles: ['hr', 'admin'] },
        { path: '/management/report', label: 'Management Report', icon: Eye, roles: ['management', 'admin'] },
      ],
    },
    general: {
      label: 'General',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar, roles: ['admin', 'hr', 'supervisor', 'employee', 'management'] },
        { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr', 'supervisor', 'employee', 'management'] },
      ],
    },
  };

  const activeGroup = getActiveGroup();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-4 py-5">
          <img src={tidalLogo} alt="Tidal Group" className="h-16 w-auto object-contain" />
          {open && (
            <span className="text-lg font-semibold text-sidebar-foreground">OTMS</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(menuGroups).map(([groupKey, group]) => {
          // Only show items that match the currently active role
          const filteredItems = group.items.filter(item =>
            activeRole && item.roles.includes(activeRole as AppRole)
          );
          
          // Skip rendering empty groups
          if (filteredItems.length === 0) return null;
          
          const isGroupActive = groupKey === activeGroup;
          const isOpen = openGroups[groupKey] || isGroupActive;

          return (
            <Collapsible
              key={groupKey}
              open={isOpen}
              onOpenChange={(open) => 
                setOpenGroups(prev => ({ ...prev, [groupKey]: open }))
              }
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer flex items-center justify-between hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5">
                    <span>{group.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredItems.map((item) => (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.path} end className={getNavCls}>
                              <item.icon className="mr-2 h-4 w-4" />
                              {open && <span>{item.label}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { activeRole } = useActiveRole();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      // Always navigate, even if signOut had errors
      navigate('/auth');
    }
  };

  // Generate breadcrumb items from current path
  const generateBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    
    const breadcrumbLabels: Record<string, string> = {
      'admin': 'Admin',
      'hr': 'HR',
      'supervisor': 'Supervisor',
      'employee': 'Employee',
      'management': 'Management',
      'dashboard': 'Dashboard',
      'approve': 'Approve OT',
      'verify': 'Verify OT',
      'certify': 'Certify OT',
      'employees': 'Employees',
      'departments': 'Departments',
      'ot-reports': 'OT Reports',
      'report': 'Report',
      'ot': 'OT',
      'submit': 'Submit OT',
      'history': 'OT History',
      'settings': 'Settings',
      'calendar': 'Calendar',
      'profile': 'Profile',
    };

    return paths.map((path, index) => {
      const fullPath = '/' + paths.slice(0, index + 1).join('/');
      const label = breadcrumbLabels[path] || path.charAt(0).toUpperCase() + path.slice(1);
      return { path: fullPath, label, isLast: index === paths.length - 1 };
    });
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeRole={activeRole} />
        <div className="flex-1 flex flex-col">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            border-b bg-card flex items-center justify-between
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <DashboardSwitcher />
            </div>
            <div className={`flex items-center ${deviceType === 'mobile' ? 'gap-2' : deviceType === 'tablet' ? 'gap-3' : 'gap-4'}`}>
              <NotificationBell />
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={deviceType !== 'desktop' ? 'w-48' : ''}>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  {deviceType === 'mobile' && user?.email && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        {user.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className={`
            flex-1 overflow-auto
            ${deviceType === 'mobile' ? 'p-4' : deviceType === 'tablet' ? 'p-5' : 'p-6'}
          `}>
            <InstallBanner />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}