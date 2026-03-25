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
  Wallet,
  Receipt,
  FileText,
  User,
  LogOut,
  Calendar,
  Settings,
  CheckCircle,
  Building2,
  BookOpen,
  Users,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { generateBreadcrumbs } from './layoutUtils';
import { AppRole } from '@/types/otms';

interface FinanceLayoutProps {
  children: ReactNode;
  activeRole: string | null;
}

function FinanceSidebar({ activeRole }: { activeRole: string | null }) {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary" : "hover:bg-sidebar-accent/50 border-l-2 border-transparent";

  // State for collapsible groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dashboards: currentPath.includes('/dashboard'),
    workflow: currentPath.includes('/workflow'),
    financeSetup: currentPath.includes('/setup') || currentPath.includes('/masters'),
    financeCash: currentPath.includes('/petty-cash') || currentPath.includes('/cashbook') || currentPath.includes('/bank') || currentPath.includes('/opening-balance'),
    financeGL: currentPath.includes('/gl') && !currentPath.includes('/cashbook') && !currentPath.includes('/opening-balance') || currentPath.includes('/claims') || currentPath.includes('/wages'),
    financeAP: currentPath.includes('/ap/prf') || currentPath.includes('/ap/payment-vouchers'),
    financeAR: currentPath.includes('/ar/official-receipts'),
    financeCustomer: currentPath.includes('/ar/') && !currentPath.includes('official-receipts'),
    financeSupplier: currentPath.includes('/ap/') && !currentPath.includes('prf') && !currentPath.includes('payment-vouchers'),
    financeReports: currentPath.includes('/finance/reports'),
    general: true,
  });

  const menuGroups = {
    dashboards: {
      label: 'Core',
      items: [
        { path: '/finance/dashboard', label: 'Finance Dashboard', icon: LayoutDashboard },
        { path: '/finance/workflow/inbox', label: 'Approval Inbox', icon: CheckCircle },
        { path: '/finance/memos', label: 'Memos', icon: Wallet },
      ],
    },
    financeSetup: {
      label: 'Finance Setup',
      items: [
        { path: '/finance/setup/company-profile', label: 'Company Profile', icon: Building2 },
        { path: '/finance/setup/coa', label: 'Chart of Accounts', icon: BookOpen },
        { path: '/finance/setup/doa-matrix', label: 'DOA Matrix', icon: CheckCircle },
        { path: '/finance/masters/suppliers', label: 'Suppliers', icon: Users },
        { path: '/finance/masters/customers', label: 'Customers', icon: Users },
        { path: '/finance/masters/bank-accounts', label: 'Bank Accounts', icon: Banknote },
      ],
    },
    financeCash: {
      label: 'Cash & Banking',
      items: [
        { path: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet },
        { path: '/finance/gl/cashbook', label: 'Cash Book', icon: BookOpen },
        { path: '/finance/bank/reconciliation', label: 'Bank Reconciliation', icon: CheckCircle },
        { path: '/finance/gl/opening-balance', label: 'Opening Balance', icon: BookOpen },
      ],
    },
    financeGL: {
      label: 'General Ledger',
      items: [
        { path: '/finance/gl/journal-entries', label: 'Journal Entries', icon: BookOpen },
        { path: '/finance/claims', label: 'Claims Posting', icon: Receipt },
        { path: '/finance/wages', label: 'Wages', icon: Banknote },
      ],
    },
    financeAP: {
      label: 'Accounts Payable',
      items: [
        { path: '/finance/ap/prf', label: 'Payment Requisitions', icon: FileText },
        { path: '/finance/ap/payment-vouchers', label: 'Payment Vouchers', icon: CreditCard },
      ],
    },
    financeAR: {
      label: 'Accounts Receivable',
      items: [
        { path: '/finance/ar/official-receipts', label: 'Official Receipts', icon: CreditCard },
      ],
    },
    financeCustomer: {
      label: 'Customer Master',
      items: [
        { path: '/finance/ar/notes', label: 'AR Debit/Credit Notes', icon: FileText },
        { path: '/finance/ar/invoices', label: 'AR Invoices', icon: Receipt },
        { path: '/finance/ar/payments', label: 'AR Payment', icon: CreditCard },
      ],
    },
    financeSupplier: {
      label: 'Supplier Master',
      items: [
        { path: '/finance/ap/notes', label: 'AP Debit/Credit Notes', icon: FileText },
        { path: '/finance/ap/invoices', label: 'AP Invoices', icon: Receipt },
        { path: '/finance/ap/payments', label: 'AP Payment', icon: CreditCard },
      ],
    },
    financeReports: {
      label: 'Reports & Analytics',
      items: [
        { path: '/finance/reports', label: 'Finance Reports', icon: FileText },
      ],
    },
    general: {
      label: 'System',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar },
        { path: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  };

  return (
    <Sidebar className="border-r-slate-200 dark:border-r-slate-800 bg-slate-50 dark:bg-slate-950">
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <img src={tidalLogo} alt="Tidal Group" className="h-9 w-auto object-contain" />
          {open && (
            <div className="flex flex-col">
              <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">Tidal Portal</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 uppercase tracking-widest">Finance</span>
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

export function FinanceLayout({ children, activeRole }: FinanceLayoutProps) {
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
        <FinanceSidebar activeRole={activeRole} />
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
                  {breadcrumbs.map((item, index) => (
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
