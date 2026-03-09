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
  PlusCircle,
  History,
  CalendarOff,
  Clock,
  FileText,
  User,
  LogOut,
  Calendar,
  Settings,
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';

interface EmployeeLayoutProps {
  children: ReactNode;
}

function EmployeeSidebar() {
  const { open } = useSidebar();
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  const navItems = [
    {
      label: 'Home & Actions',
      items: [
        { path: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/ot/submit', label: 'Submit OT', icon: PlusCircle },
        { path: '/leave/request', label: 'Apply Leave', icon: CalendarOff },
        { path: '/claims/submit', label: 'Submit Claim', icon: PlusCircle },
      ]
    },
    {
      label: 'Records & History',
      items: [
        { path: '/ot/history', label: 'OT History', icon: History },
        { path: '/leave/history', label: 'Leave History', icon: History },
        { path: '/claims/history', label: 'Claim History', icon: History },
        { path: '/attendance/history', label: 'My Attendance', icon: Clock },
        { path: '/employee/payslips', label: 'My Payslips', icon: FileText },
      ]
    },
    {
      label: 'General',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar },
        { path: '/settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  return (
    <Sidebar className="border-r-slate-200 dark:border-r-slate-800 bg-slate-50 dark:bg-slate-950">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-4 py-5">
          <img src={tidalLogo} alt="Tidal Group" className="h-10 w-auto object-contain" />
          {open && (
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">Employee Space</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        {navItems.map((group, i) => (
          <SidebarGroup key={i}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</SidebarGroupLabel>
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

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
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
      <div className="min-h-screen flex w-full bg-slate-50 dark:bg-slate-950">
        <EmployeeSidebar />
        <div className="flex-1 flex flex-col items-center">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            border-b border-slate-200 dark:border-slate-800 bg-card/80 backdrop-blur-md flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" />
              <DashboardSwitcher />

              <Breadcrumb className="hidden md:flex ml-4">
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <BreadcrumbItem key={item.path}>
                      {!item.isLast ? (
                        <>
                          <BreadcrumbLink asChild>
                            <NavLink to={item.path}>{item.label}</NavLink>
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      ) : (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
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
                  <Button variant="ghost" size="sm" className="gap-2 rounded-full hidden sm:flex">
                    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">{user?.email?.split('@')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
            flex-1 overflow-auto w-full max-w-7xl mx-auto
            ${deviceType === 'mobile' ? 'p-4' : deviceType === 'tablet' ? 'p-5' : 'p-6 md:p-8'}
          `}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
