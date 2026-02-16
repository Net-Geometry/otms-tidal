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
import { DashboardSwitcher } from '@/components/DashboardSwitcher';
import {
  LayoutDashboard, 
  PlusCircle, 
  History, 
  CheckCircle, 
  Users, 
  Building2,
  Wallet,
  CalendarOff,
  Clock,
  Receipt,
  CreditCard,
  BookOpen,
  BarChart3,
  Banknote,
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
    financeManagement: false,
    financeSetup: false,
    financeCash: false,
    financeGL: false,
    financeAP: false,
    financeAR: false,
    financeReports: false,
    reports: false,
    general: true, // open by default
  });

  // Determine which group contains the active route
  const getActiveGroup = () => {
    if (currentPath === '/finance/dashboard' || currentPath === '/finance/workflow/inbox') return 'financeManagement';
    if (currentPath.startsWith('/finance/setup/') || currentPath.startsWith('/finance/masters/')) return 'financeSetup';
    if (currentPath.startsWith('/finance/petty-cash') || currentPath.startsWith('/finance/gl/cashbook') || currentPath.startsWith('/finance/bank/') || currentPath.startsWith('/finance/gl/opening-balance')) return 'financeCash';
    if (currentPath.startsWith('/finance/gl/') || currentPath.startsWith('/finance/claims') || currentPath.startsWith('/finance/wages') || currentPath.startsWith('/finance/project-costing')) return 'financeGL';
    if (currentPath.startsWith('/finance/ap/')) return 'financeAP';
    if (currentPath.startsWith('/finance/ar/')) return 'financeAR';
    if (currentPath.startsWith('/finance/reports')) return 'financeReports';
    if (currentPath.includes('/dashboard')) return 'dashboards';
    if (
      currentPath.includes('/ot/') ||
      currentPath.includes('/leave/') ||
      currentPath.includes('/claims/') ||
      currentPath.includes('/attendance/') ||
      currentPath.includes('/verify') ||
      currentPath.includes('/approve') ||
      currentPath.includes('/certify')
    ) return 'otManagement';
    if (currentPath.includes('/report')) return 'reports';
    if (currentPath.startsWith('/hr/')) return 'hrManagement';
    return 'general';
  };

  // Helper function to get calendar path based on role
  const getCalendarPath = (role: string | null) => {
    return '/calendar';
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
        { path: '/leave/request', label: 'Leave Request', icon: CalendarOff, roles: ['employee'] },
        { path: '/leave/history', label: 'Leave History', icon: History, roles: ['employee'] },
        { path: '/claims/submit', label: 'Submit Claim', icon: PlusCircle, roles: ['employee'] },
        { path: '/claims/history', label: 'Claim History', icon: History, roles: ['employee'] },
        { path: '/attendance/history', label: 'My Attendance', icon: Clock, roles: ['employee'] },
        { path: '/employee/payslips', label: 'My Payslips', icon: FileText, roles: ['employee'] },
        { path: '/supervisor/verify', label: 'Verify OT', icon: CheckCircle, roles: ['supervisor', 'admin'] },
        { path: '/supervisor/approve-leave', label: 'Approve Leave', icon: CheckCircle, roles: ['supervisor', 'admin'] },
        { path: '/supervisor/approve-claims', label: 'Approve Claims', icon: CheckCircle, roles: ['supervisor', 'admin'] },
        { path: '/hr/approve', label: 'Certify OT', icon: CheckCircle, roles: ['hr', 'admin'] },
        { path: '/management/approve', label: 'Approve OT', icon: CheckCircle, roles: ['management', 'admin'] },
      ],
    },
    hrManagement: {
      label: 'HR Management',
      items: [
        { path: '/hr/employees', label: 'Employees', icon: Users, roles: ['hr', 'admin'] },
        { path: '/hr/departments', label: 'Departments', icon: Building2, roles: ['hr', 'admin'] },
        { path: '/hr/payroll', label: 'Payroll', icon: Wallet, roles: ['hr', 'admin'] },
        { path: '/hr/leave', label: 'Leave', icon: CalendarOff, roles: ['hr', 'admin'] },
        { path: '/hr/attendance', label: 'Attendance', icon: Clock, roles: ['hr', 'admin'] },
        { path: '/hr/claims', label: 'Claims', icon: Receipt, roles: ['hr', 'admin'] },
      ],
    },
    financeManagement: {
      label: 'Finance',
      items: [
        { path: '/finance/dashboard', label: 'Finance Dashboard', icon: LayoutDashboard, roles: ['finance', 'admin'] },
        { path: '/finance/workflow/inbox', label: 'Approval Inbox', icon: CheckCircle, roles: ['finance', 'admin'] },
      ],
    },
    financeSetup: {
      label: 'Finance Setup',
      items: [
        { path: '/finance/setup/company-profile', label: 'Company Profile', icon: Building2, roles: ['finance', 'admin'] },
        { path: '/finance/setup/coa', label: 'Chart of Accounts', icon: BookOpen, roles: ['finance', 'admin'] },
        { path: '/finance/setup/doa-matrix', label: 'DOA Matrix', icon: CheckCircle, roles: ['finance', 'admin'] },
        { path: '/finance/masters/suppliers', label: 'Suppliers', icon: Users, roles: ['finance', 'admin'] },
        { path: '/finance/masters/customers', label: 'Customers', icon: Users, roles: ['finance', 'admin'] },
        { path: '/finance/masters/bank-accounts', label: 'Bank Accounts', icon: Banknote, roles: ['finance', 'admin'] },
      ],
    },
    financeCash: {
      label: 'Cash & Banking',
      items: [
        { path: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet, roles: ['finance', 'admin'] },
        { path: '/finance/gl/cashbook', label: 'Cash Book', icon: BookOpen, roles: ['finance', 'admin'] },
        { path: '/finance/bank/reconciliation', label: 'Bank Reconciliation', icon: CheckCircle, roles: ['finance', 'admin'] },
        { path: '/finance/gl/opening-balance', label: 'Opening Balance', icon: BookOpen, roles: ['finance', 'admin'] },
      ],
    },
    financeGL: {
      label: 'General Ledger',
      items: [
        { path: '/finance/gl/journal-entries', label: 'Journal Entries', icon: BookOpen, roles: ['finance', 'admin'] },
        { path: '/finance/claims', label: 'Claims Posting', icon: Receipt, roles: ['finance', 'admin'] },
        { path: '/finance/wages', label: 'Wages', icon: Banknote, roles: ['finance', 'admin'] },
        { path: '/finance/project-costing', label: 'Project Costing', icon: BarChart3, roles: ['finance', 'admin'] },
      ],
    },
    financeAP: {
      label: 'Accounts Payable',
      items: [
        { path: '/finance/ap/prf', label: 'Purchase Requisitions', icon: FileText, roles: ['finance', 'admin'] },
        { path: '/finance/ap/invoices', label: 'AP Invoices', icon: Receipt, roles: ['finance', 'admin'] },
        { path: '/finance/ap/payment-vouchers', label: 'Payment Vouchers', icon: CreditCard, roles: ['finance', 'admin'] },
        { path: '/finance/ap/notes', label: 'AP Debit/Credit Notes', icon: FileText, roles: ['finance', 'admin'] },
      ],
    },
    financeAR: {
      label: 'Accounts Receivable',
      items: [
        { path: '/finance/ar/invoices', label: 'AR Invoices', icon: Receipt, roles: ['finance', 'admin'] },
        { path: '/finance/ar/official-receipts', label: 'Official Receipts', icon: CreditCard, roles: ['finance', 'admin'] },
        { path: '/finance/ar/notes', label: 'AR Debit/Credit Notes', icon: FileText, roles: ['finance', 'admin'] },
      ],
    },
    financeReports: {
      label: 'Finance Reports',
      items: [
        { path: '/finance/reports', label: 'Finance Reports', icon: FileText, roles: ['finance', 'admin'] },
      ],
    },
    reports: {
      label: 'Reports',
      items: [
        { path: '/hr/ot-reports', label: 'OT Reports', icon: FileText, roles: ['hr', 'admin'] },
        { path: '/management/approve-leave', label: 'Approve Leave', icon: CheckCircle, roles: ['management', 'admin'] },
        { path: '/management/report', label: 'Management Report', icon: Eye, roles: ['management', 'admin'] },
      ],
    },
    general: {
      label: 'General',
      items: [
        { path: getCalendarPath(activeRole), label: 'Calendar', icon: Calendar, roles: ['admin', 'hr', 'finance', 'supervisor', 'employee', 'management'] },
        { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr', 'finance', 'supervisor', 'employee', 'management'] },
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
      <SidebarContent className="scrollbar-thin">
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
      'finance': 'Finance',
      'supervisor': 'Supervisor',
      'employee': 'Employee',
      'management': 'Management',
      'dashboard': 'Dashboard',
      'approve': 'Approve OT',
      'verify': 'Verify OT',
      'certify': 'Certify OT',
      'employees': 'Employees',
      'departments': 'Departments',
      'payroll': 'Payroll',
      'payslips': 'My Payslips',
      'leave': 'Leave',
      'attendance': 'Attendance',
      'claims': 'Claims',
      'chart-of-accounts': 'Chart of Accounts',
      'setup': 'Setup',
      'coa': 'Chart of Accounts',
      'doa-matrix': 'DOA Matrix',
      'company-profile': 'Company Profile',
      'masters': 'Masters',
      'suppliers': 'Suppliers',
      'customers': 'Customers',
      'bank-accounts': 'Bank Accounts',
      'workflow': 'Workflow',
      'inbox': 'Approval Inbox',
      'gl': 'General Ledger',
      'ap': 'Accounts Payable',
      'ar': 'Accounts Receivable',
      'prf': 'Purchase Requisitions',
      'invoices': 'Invoices',
      'payment-vouchers': 'Payment Vouchers',
      'official-receipts': 'Official Receipts',
      'journal-entries': 'Journal Entries',
      'cashbook': 'Cash Book',
      'opening-balance': 'Opening Balance',
      'notes': 'Debit/Credit Notes',
      'bank': 'Banking',
      'reconciliation': 'Bank Reconciliation',
      'petty-cash': 'Petty Cash',
      'project-costing': 'Project Costing',
      'wages': 'Wages',
      'ot-reports': 'OT Reports',
      'report': 'Report',
      'ot': 'OT',
      'submit': 'Submit OT',
      'history': 'History',
      'request': 'Request',
      'approve-leave': 'Approve Leave',
      'approve-claims': 'Approve Claims',
      'settings': 'Settings',
      'calendar': 'Holiday Calendars',
      'profile': 'Profile',
      'new': 'New',
      'edit': 'Edit',
    };

    return paths
      .filter((path, index) => {
        // Filter out UUID-like paths (calendar IDs)
        if (index > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) {
          return false;
        }
        // Filter out numeric IDs
        if (index > 0 && /^\d+$/.test(path)) {
          return false;
        }
        return true;
      })
      .map((path, index, filteredPaths) => {
        const originalIndex = paths.indexOf(path);
        const fullPath = '/' + paths.slice(0, originalIndex + 1).join('/');

        // Context-aware labels for ambiguous segments
        const prevSeg = originalIndex > 0 ? paths[originalIndex - 1] : null;
        let label = breadcrumbLabels[path] || path.charAt(0).toUpperCase() + path.slice(1);
        if (path === 'history' && prevSeg === 'ot') label = 'OT History';
        if (path === 'history' && prevSeg === 'leave') label = 'Leave History';
        if (path === 'history' && prevSeg === 'attendance') label = 'Attendance History';
        if (path === 'history' && prevSeg === 'claims') label = 'Claim History';
        if (path === 'submit' && prevSeg === 'claims') label = 'Submit Claim';
        if (path === 'invoices' && prevSeg === 'ap') label = 'AP Invoices';
        if (path === 'invoices' && prevSeg === 'ar') label = 'AR Invoices';

        return { path: fullPath, label, isLast: index === filteredPaths.length - 1 };
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
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
