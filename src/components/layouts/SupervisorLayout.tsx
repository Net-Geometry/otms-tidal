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
  CheckCircle,
  Calendar,
  Settings,
  User,
  LogOut,
  BadgeCheck,
  CalendarPlus,
  CalendarDays,
  PlusCircle,
  History,
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';

interface SupervisorLayoutProps {
  children: ReactNode;
}

function SupervisorSidebar() {
  const { open } = useSidebar();
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  const navItems = [
    {
      label: 'Supervisor Tasks',
      items: [
        { path: '/supervisor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/supervisor/verify', label: 'Verify OT', icon: CheckCircle },
        { path: '/supervisor/approve-leave', label: 'Approve Leave', icon: CheckCircle },
        { path: '/supervisor/approve-claims', label: 'Approve Claims', icon: BadgeCheck },
      ]
    },
    {
      label: 'Personal Space',
      items: [
        { path: '/leave/request', label: 'Apply Leave', icon: CalendarPlus },
        { path: '/leave/history', label: 'Leave History', icon: CalendarDays },
        { path: '/claims/submit', label: 'Submit Claim', icon: PlusCircle },
        { path: '/claims/history', label: 'Claim History', icon: History },
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
    <Sidebar className="border-r-blue-100 dark:border-r-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-4 py-5">
          <img src={tidalLogo} alt="Tidal Group" className="h-12 w-auto object-contain" />
          {open && (
            <span className="text-lg font-semibold text-blue-900 dark:text-blue-200">Supervisor</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        {navItems.map((group, i) => (
          <SidebarGroup key={i}>
            <SidebarGroupLabel className="px-3 text-blue-700/70 dark:text-blue-400/70 uppercase tracking-wider text-[11px] font-semibold">{group.label}</SidebarGroupLabel>
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

export function SupervisorLayout({ children }: SupervisorLayoutProps) {
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
        <SupervisorSidebar />
        <div className="flex-1 flex flex-col items-center shadow-[-20px_0_20px_-20px_rgba(0,0,0,0.1)] z-10 bg-background">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            border-b flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger />
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
                        <BreadcrumbPage className="font-semibold text-blue-600 dark:text-blue-400">{item.label}</BreadcrumbPage>
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
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.email?.split('@')[0]}</span>
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
            <div className="mx-auto max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
