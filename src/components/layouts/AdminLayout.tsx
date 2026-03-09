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
  Upload,
  Settings,
  Users,
  Building2,
  Calendar,
  Lock,
  Database,
  Network,
  User,
  LogOut
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';

interface AdminLayoutProps {
  children: ReactNode;
  activeRole: string | null;
}

function AdminSidebar({ activeRole }: { activeRole: string | null }) {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-slate-800 text-slate-50 dark:bg-slate-800 dark:text-slate-50 font-medium" : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    system: true,
    data: true,
    users: true,
  });

  const menuGroups = {
    system: {
      label: 'System Management',
      items: [
        { path: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
        { path: '/settings', label: 'Global Settings', icon: Settings },
      ]
    },
    data: {
      label: 'Data Operations',
      items: [
        { path: '/admin/bulk-import-ot', label: 'Bulk Import OT', icon: Upload },
        { path: '/hr/holidays', label: 'Manage Holidays', icon: Calendar },
        { path: '/hr/departments', label: 'Departments', icon: Building2 },
        { path: '/hr/org-chart', label: 'Org Chart', icon: Network },
      ]
    },
    users: {
      label: 'User Management',
      items: [
        { path: '/hr/employees', label: 'All Employees', icon: Users },
        { path: '/hr/employees/archived', label: 'Archived Users', icon: Lock },
      ]
    }
  };

  return (
    <Sidebar className="border-r-slate-300 dark:border-r-slate-800 bg-slate-100 dark:bg-slate-950">
      <SidebarHeader className="border-b border-slate-300 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="h-8 w-8 bg-slate-900 dark:bg-slate-100 rounded-md flex items-center justify-center">
            <Database className="h-4 w-4 text-slate-50 dark:text-slate-900" />
          </div>
          {open && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase font-mono">Sys Admin</span>
              <span className="text-[10px] text-slate-500 font-mono">SYSTEM CONTROL</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin p-2">
        {Object.entries(menuGroups).map(([groupKey, group]) => {
          const isOpen = openGroups[groupKey];
          return (
            <Collapsible
              key={groupKey}
              open={isOpen}
              onOpenChange={(open) => 
                setOpenGroups(prev => ({ ...prev, [groupKey]: open }))
              }
              className="mb-1"
            >
              <SidebarGroup className="p-0">
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800/50 rounded-md px-3 py-1 font-semibold text-[11px] text-slate-500 uppercase tracking-widest">
                    <span>{group.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent className="px-1 mt-1">
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.path} end className={getNavCls}>
                              <item.icon className="mr-2 h-[15px] w-[15px]" />
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

export function AdminLayout({ children, activeRole }: AdminLayoutProps) {
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
        <AdminSidebar activeRole={activeRole} />
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#09090b]">
          <header className={`
            ${deviceType === 'mobile' ? 'h-14' : deviceType === 'tablet' ? 'h-15' : 'h-16'}
            flex items-center justify-between w-full
            ${deviceType === 'mobile' ? 'px-4' : deviceType === 'tablet' ? 'px-5' : 'px-6'}
            sticky top-0 z-30 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm
          `}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-600 hover:text-slate-900" />
              <DashboardSwitcher />
              
              <Breadcrumb className="hidden md:flex ml-4">
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <BreadcrumbItem key={item.path}>
                      {!item.isLast ? (
                        <>
                          <BreadcrumbLink asChild>
                             <NavLink to={item.path} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300">{item.label}</NavLink>
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
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline font-medium">{user?.email?.split('@')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
