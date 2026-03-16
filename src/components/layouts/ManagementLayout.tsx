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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import tidalLogo from '@/assets/tidal-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  FileText,
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';

interface ManagementLayoutProps {
  children: ReactNode;
  activeRole: string | null;
}

function ManagementSidebar() {
  const { open } = useSidebar();
  const { roles } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary" : "hover:bg-sidebar-accent/50 border-l-2 border-transparent";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    executive: currentPath.includes('/dashboard') || currentPath.includes('/report'),
    approvals: currentPath.includes('/approve'),
    system: true,
  });

  // Only assistant_manager and dmd are in the PV approval workflow
  const canApprovePV = roles.includes('assistant_manager') || roles.includes('dmd');

  const approvalItems = [
    { path: '/management/approve', label: 'Approve OT', icon: CheckCircle },
    { path: '/management/approve-leave', label: 'Approve Leave', icon: CheckCircle },
    { path: '/management/approve-claims', label: 'Approve Claims', icon: Receipt },
    { path: '/management/approve-payroll', label: 'Approve Payroll', icon: Wallet },
    { path: '/management/approve-prf', label: 'Approve PRF', icon: CheckCircle },
    ...(canApprovePV ? [{ path: '/management/approve-pv', label: 'Approve PV', icon: CheckCircle }] : []),
    ...(canApprovePV ? [{ path: '/management/approve-ap-payment', label: 'Approve AP Payment', icon: CheckCircle }] : []),
    { path: '/management/memo-approval', label: 'Approve Memos', icon: FileText },
  ];

  const menuGroups = {
    executive: {
      label: 'Executive View',
      items: [
        { path: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/management/report', label: 'Management Report', icon: Eye },
      ],
    },
    approvals: {
      label: 'Approvals',
      items: approvalItems,
    },
    system: {
      label: 'System',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar },
        { path: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <img src={tidalLogo} alt="Tidal Group" className="h-9 w-auto object-contain" />
          {open && (
            <div className="flex flex-col">
              <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">Net-Geometry</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 uppercase tracking-widest">Management</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        {Object.entries(menuGroups).map(([groupKey, group]) => {
          const isOpen = openGroups[groupKey];
          return (
            <Collapsible
              key={groupKey}
              open={isOpen}
              onOpenChange={(open) =>
                setOpenGroups(prev => ({ ...prev, [groupKey]: open }))
              }
              className="mt-1"
            >
              <SidebarGroup className="py-0">
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 rounded-none px-4 py-2 h-9 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    <span className="text-[11px] uppercase tracking-wider font-semibold">{group.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform text-slate-400 ${isOpen ? 'rotate-180 text-foreground' : ''}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent className="px-2 pb-1">
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
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
        <ManagementSidebar />
        <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-900">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" />
              <DashboardSwitcher />

              <Breadcrumb className="hidden md:flex ml-4">
                <BreadcrumbList>
                  {breadcrumbs.map((item) => (
                    <BreadcrumbItem key={item.path}>
                      {!item.isLast ? (
                        <>
                          <BreadcrumbLink asChild>
                             <NavLink to={item.path} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">{item.label}</NavLink>
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      ) : (
                        <BreadcrumbPage className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</BreadcrumbPage>
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
                  <Button variant="ghost" size="sm" className="gap-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100">
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
            ${deviceType === 'mobile' ? 'p-4' : deviceType === 'tablet' ? 'p-5' : 'p-6 md:p-8 md:pt-6'}
          `}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
