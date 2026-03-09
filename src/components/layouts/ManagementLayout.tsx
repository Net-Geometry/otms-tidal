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
  Wallet,
  Receipt,
  Eye,
  User,
  LogOut,
  Calendar,
  Settings,
  CheckCircle,
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';

interface ManagementLayoutProps {
  children: ReactNode;
  activeRole: string | null;
}

function ManagementSidebar({ activeRole }: { activeRole: string | null }) {
  const { open } = useSidebar();
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  const navItems = [
    {
      label: 'Executive View',
      items: [
        { path: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/management/report', label: 'Management Report', icon: Eye },
      ]
    },
    {
      label: 'Approvals',
      items: [
        { path: '/management/approve', label: 'Approve OT', icon: CheckCircle },
        { path: '/management/approve-leave', label: 'Approve Leave', icon: CheckCircle },
        { path: '/management/approve-claims', label: 'Approve Claims', icon: Receipt },
        { path: '/hr/payroll', label: 'Approve Payroll', icon: Wallet },
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
    <Sidebar className="border-r-amber-200 dark:border-r-amber-900/50 bg-slate-50 dark:bg-slate-950">
      <SidebarHeader className="border-b border-amber-100 dark:border-amber-900/30">
        <div className="flex items-center gap-3 px-4 py-5">
          <img src={tidalLogo} alt="Tidal Group" className="h-10 w-auto object-contain" />
          {open && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">OTMS</span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Management</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin p-3">
        {navItems.map((group, i) => (
          <SidebarGroup key={i} className="mb-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-0">
            <SidebarGroupLabel className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="p-1">
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild className="rounded-lg my-0.5">
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

export function ManagementLayout({ children, activeRole }: ManagementLayoutProps) {
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
        <ManagementSidebar activeRole={activeRole} />
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-500 hover:text-amber-600 dark:hover:text-amber-400" />
              <DashboardSwitcher />
              
              <Breadcrumb className="hidden md:flex ml-4">
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <BreadcrumbItem key={item.path}>
                      {!item.isLast ? (
                        <>
                          <BreadcrumbLink asChild>
                             <NavLink to={item.path} className="text-slate-500 hover:text-amber-600 dark:hover:text-amber-400">{item.label}</NavLink>
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      ) : (
                        <BreadcrumbPage className="font-semibold text-amber-700 dark:text-amber-500">{item.label}</BreadcrumbPage>
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
                  <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                    <User className="h-4 w-4" />
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
