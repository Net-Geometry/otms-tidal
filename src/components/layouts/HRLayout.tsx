import { ReactNode, useState } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceType } from '@/hooks/use-mobile';
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
import { DashboardSwitcher } from '@/components/DashboardSwitcher';
import {
  LayoutDashboard, 
  Users, 
  Building2,
  Wallet,
  CalendarOff,
  Clock,
  Receipt,
  FileText,
  User,
  LogOut,
  Calendar,
  Settings,
  CheckCircle,
  Network
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';
import { ALL_FINANCE_ROLES } from '@/lib/financeRoles';

interface HRLayoutProps {
  children: ReactNode;
  activeRole: string | null;
}

function HRSidebar({ activeRole }: { activeRole: string | null }) {
  const { open } = useSidebar();
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  const navItems = [
    {
      label: 'Home',
      items: [
        { path: '/hr/dashboard', label: 'HR Dashboard', icon: LayoutDashboard },
        { path: '/hr/approve', label: 'Certify OT', icon: CheckCircle },
      ]
    },
    {
      label: 'Directory',
      items: [
        { path: '/hr/employees', label: 'Employees', icon: Users },
        { path: '/hr/departments', label: 'Departments', icon: Building2 },
        { path: '/hr/org-chart', label: 'Org Chart', icon: Network },
      ]
    },
    {
      label: 'Operations',
      items: [
        { path: '/hr/payroll', label: 'Payroll', icon: Wallet },
        { path: '/hr/leave', label: 'Leave', icon: CalendarOff },
        { path: '/hr/attendance', label: 'Attendance', icon: Clock },
        { path: '/hr/claims', label: 'Claims', icon: Receipt },
        { path: '/hr/memos', label: 'Memos', icon: FileText },
      ]
    },
    {
      label: 'Insights',
      items: [
        { path: '/hr/ot-reports', label: 'OT Reports', icon: FileText },
      ]
    },
    {
      label: 'System',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar },
        { path: '/settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  return (
    <Sidebar className="border-r-slate-200 dark:border-r-slate-800 bg-slate-50 dark:bg-slate-950">
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-2 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={tidalLogo} alt="Tidal Group" className="h-8 w-auto object-contain" />
            {open && (
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tidal Portal</span>
            )}
          </div>
          {open && (
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 w-fit">
              Human Resources
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin p-2">
        {navItems.map((group, i) => (
          <SidebarGroup key={i} className="mb-2">
            <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.path} end className={getNavCls}>
                        <item.icon className="mr-2 h-[15px] w-[15px] text-slate-500" />
                        {open && <span className="text-[13px]">{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function HRLayout({ children, activeRole }: HRLayoutProps) {
  const { user, signOut } = useAuth();
  const deviceType = useDeviceType();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      navigate('/auth');
    }
  };

  const breadcrumbs = generateBreadcrumbs(location.pathname);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <HRSidebar activeRole={activeRole} />
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" />
              <DashboardSwitcher />
              
              <Breadcrumb className="hidden md:flex ml-4">
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <BreadcrumbItem key={item.path}>
                      {!item.isLast ? (
                        <>
                          <BreadcrumbLink asChild>
                             <NavLink to={item.path} className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400">{item.label}</NavLink>
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      ) : (
                        <BreadcrumbPage className="font-medium text-slate-900 dark:text-slate-100">{item.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className={`flex items-center ${deviceType === 'mobile' ? 'gap-2' : deviceType === 'tablet' ? 'gap-3' : 'gap-4'}`}>
              <NotificationBell />
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="hidden sm:inline font-medium">{user?.email?.split('@')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
            flex-1 overflow-auto w-full
            ${deviceType === 'mobile' ? 'p-4' : deviceType === 'tablet' ? 'p-5' : 'p-6 md:p-8'}
          `}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
