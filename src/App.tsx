import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ActiveRoleProvider } from "./hooks/useActiveRole";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthGuard } from "./components/AuthGuard";
import { RootRedirect } from "./components/RootRedirect";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/theme-provider";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { HTTPSWarning } from "./components/pwa/HTTPSWarning";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "./lib/queryClient";
import { ContentLoadingSkeleton } from "./components/ContentLoadingSkeleton";
import { HolidayManagement } from "./components/admin/HolidayManagement";
import { ALL_FINANCE_ROLES } from "./lib/financeRoles";

const FINANCE_ROUTE_ROLES = [...ALL_FINANCE_ROLES, 'admin'] as const;
const MANAGEMENT_ROUTE_ROLES = ['management', 'director', 'gm', 'sgm', 'dmd', 'assistant_manager', 'manager', 'admin'] as const;

// Keep auth routes eager for fast login experience
import Auth from "./pages/Auth";
import SetPassword from "./pages/SetPassword";
import SetupPassword from "./pages/SetupPassword";
import ChangePassword from "./pages/ChangePassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";

// Lazy load all dashboard routes
const EmployeeDashboard = lazy(() => import("./pages/employee/EmployeeDashboard"));
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard"));
const SupervisorDashboard = lazy(() => import("./pages/supervisor/SupervisorDashboard"));
const ManagementDashboard = lazy(() => import("./pages/management/ManagementDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const BulkImportOT = lazy(() => import("./pages/admin/BulkImportOT"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

// Lazy load shared routes
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Calendar = lazy(() => import("./pages/Calendar"));

// Lazy load employee routes
const SubmitOT = lazy(() => import("./pages/SubmitOT"));
const OTHistory = lazy(() => import("./pages/OTHistory"));
const LeaveRequest = lazy(() => import("./pages/employee/LeaveRequest"));
const LeaveHistory = lazy(() => import("./pages/employee/LeaveHistory"));
const ClaimSubmit = lazy(() => import("./pages/employee/ClaimSubmit"));
const ClaimHistory = lazy(() => import("./pages/employee/ClaimHistory"));
const MyAttendance = lazy(() => import("./pages/employee/MyAttendance"));
const MyPayslips = lazy(() => import("./pages/employee/MyPayslips"));

// Lazy load supervisor routes
const VerifyOT = lazy(() => import("./pages/supervisor/VerifyOT"));
const SupervisorApproveLeave = lazy(() => import("./pages/supervisor/ApproveLeave"));
const SupervisorApproveClaims = lazy(() => import("./pages/supervisor/ApproveClaims"));

// Lazy load HR routes
const ApproveOT = lazy(() => import("./pages/hr/ApproveOT"));
const Employees = lazy(() => import("./pages/hr/Employees"));
const ArchivedEmployees = lazy(() => import("./pages/hr/ArchivedEmployees"));
const Departments = lazy(() => import("./pages/hr/Departments"));
const HRSettings = lazy(() => import("./pages/hr/Settings"));
const OTReports = lazy(() => import("./pages/hr/OTReports"));

// Lazy load HR extension routes
const Payroll = lazy(() => import("./pages/hr/Payroll"));
const Leave = lazy(() => import("./pages/hr/Leave"));
const Attendance = lazy(() => import("./pages/hr/Attendance"));
const HRClaims = lazy(() => import("./pages/hr/Claims"));
const HRMemos = lazy(() => import("./pages/hr/Memos"));
const PayrollRunDetail = lazy(() => import("./pages/hr/PayrollRunDetail"));
const OrgChart = lazy(() => import("./pages/hr/OrgChart"));

// Lazy load Finance routes
const ChartOfAccounts = lazy(() => import("./pages/finance/ChartOfAccounts"));
const ClaimsPosting = lazy(() => import("./pages/finance/ClaimsPosting"));
const FinanceMemos = lazy(() => import("./pages/finance/Memos"));
const PettyCash = lazy(() => import("./pages/finance/PettyCash"));
// const ProjectCosting = lazy(() => import("./pages/finance/ProjectCosting"));
const Wages = lazy(() => import("./pages/finance/Wages"));
const FinanceReports = lazy(() => import("./pages/finance/FinanceReports"));
const SetupCompanyProfile = lazy(() => import("./pages/finance/SetupCompanyProfile"));
const SetupDoaMatrix = lazy(() => import("./pages/finance/SetupDoaMatrix"));
const MastersSuppliers = lazy(() => import("./pages/finance/MastersSuppliers"));
const MastersCustomers = lazy(() => import("./pages/finance/MastersCustomers"));
const MastersBankAccounts = lazy(() => import("./pages/finance/MastersBankAccounts"));
const WorkflowInbox = lazy(() => import("./pages/finance/WorkflowInbox"));
const JournalEntries = lazy(() => import("./pages/finance/JournalEntries"));
const PurchaseRequisitions = lazy(() => import("./pages/finance/PurchaseRequisitions"));
const ApInvoices = lazy(() => import("./pages/finance/ApInvoices"));
const PaymentVouchers = lazy(() => import("./pages/finance/PaymentVouchers"));
const ArInvoices = lazy(() => import("./pages/finance/ArInvoices"));
const OfficialReceipts = lazy(() => import("./pages/finance/OfficialReceipts"));
const ApDebitCreditNotes = lazy(() => import("./pages/finance/ApDebitCreditNotes"));
const ArDebitCreditNotes = lazy(() => import("./pages/finance/ArDebitCreditNotes"));
const CashBook = lazy(() => import("./pages/finance/CashBook"));
const OpeningBalance = lazy(() => import("./pages/finance/OpeningBalance"));
const BankReconciliation = lazy(() => import("./pages/finance/BankReconciliation"));

const ReviewOT = lazy(() => import("./pages/management/ReviewOT"));
const ManagementApproveOT = lazy(() => import("./pages/management/ApproveOT"));
const ManagementApproveLeave = lazy(() => import("./pages/management/ApproveLeave"));
const ManagementApproveClaims = lazy(() => import("./pages/management/ApproveClaims"));
const ManagementApprovePayroll = lazy(() => import("./pages/management/ApprovePayroll"));
const ManagementApprovePRF = lazy(() => import("./pages/management/ApprovePRF"));
const ManagementApproveMemos = lazy(() => import("./pages/management/ApproveMemos"));
const ManagementApprovePV = lazy(() => import("./pages/management/ApprovePV"));

const queryClient = createQueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="ot-scribe-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HTTPSWarning />
          <BrowserRouter>
            <AuthProvider>
              <ActiveRoleProvider>
                <AuthGuard>
                  <PWAInstallBanner />
                  <Suspense fallback={<ContentLoadingSkeleton />}>
                <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/set-password" element={<SetPassword />} />
                <Route path="/setup-password" element={<SetupPassword />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                
                {/* Role-specific dashboards */}
                <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/bulk-import-ot" element={<ProtectedRoute requiredRole="admin"><BulkImportOT /></ProtectedRoute>} />
                <Route path="/hr/dashboard" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRDashboard /></ProtectedRoute>} />
                <Route path="/finance/dashboard" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><FinanceDashboard /></ProtectedRoute>} />
                <Route path="/supervisor/dashboard" element={<ProtectedRoute requiredRole="supervisor"><SupervisorDashboard /></ProtectedRoute>} />
                <Route path="/employee/dashboard" element={<ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
                <Route path="/management/dashboard" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementDashboard /></ProtectedRoute>} />
                
                {/* Fallback dashboard */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                
                {/* Shared routes - all authenticated users */}
                <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                
                {/* Employee routes */}
                <Route path="/ot/submit" element={<ProtectedRoute requiredRole="employee"><SubmitOT /></ProtectedRoute>} />
                <Route path="/ot/history" element={<ProtectedRoute requiredRole="employee"><OTHistory /></ProtectedRoute>} />
                <Route path="/leave/request" element={<ProtectedRoute requiredRole="employee"><LeaveRequest /></ProtectedRoute>} />
                <Route path="/leave/history" element={<ProtectedRoute requiredRole="employee"><LeaveHistory /></ProtectedRoute>} />
                <Route path="/claims/submit" element={<ProtectedRoute requiredRole="employee"><ClaimSubmit /></ProtectedRoute>} />
                <Route path="/claims/history" element={<ProtectedRoute requiredRole="employee"><ClaimHistory /></ProtectedRoute>} />
                <Route path="/attendance/history" element={<ProtectedRoute requiredRole="employee"><MyAttendance /></ProtectedRoute>} />
                <Route path="/employee/payslips" element={<ProtectedRoute requiredRole="employee"><MyPayslips /></ProtectedRoute>} />
                 
                {/* Supervisor routes */}
                <Route path="/supervisor/verify" element={<ProtectedRoute requiredRole="supervisor"><VerifyOT /></ProtectedRoute>} />
                <Route path="/supervisor/approve-leave" element={<ProtectedRoute requiredRole="supervisor"><SupervisorApproveLeave /></ProtectedRoute>} />
                <Route path="/supervisor/approve-claims" element={<ProtectedRoute requiredRole="supervisor"><SupervisorApproveClaims /></ProtectedRoute>} />
                
                {/* HR routes */}
                <Route path="/hr/approve" element={<ProtectedRoute requiredRole={['hr', 'admin']}><ApproveOT /></ProtectedRoute>} />
                <Route path="/hr/employees" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Employees /></ProtectedRoute>} />
                <Route path="/hr/employees/archived" element={<ProtectedRoute requiredRole={['hr', 'admin']}><ArchivedEmployees /></ProtectedRoute>} />
                <Route path="/hr/departments" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Departments /></ProtectedRoute>} />
                <Route path="/hr/holidays" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HolidayManagement /></ProtectedRoute>} />
                <Route path="/hr/settings" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRSettings /></ProtectedRoute>} />
                <Route path="/hr/ot-reports" element={<ProtectedRoute requiredRole={['hr', 'admin']}><OTReports /></ProtectedRoute>} />

                {/* HR extension routes */}
                <Route path="/hr/payroll" element={<ProtectedRoute requiredRole={['hr', 'admin', 'management', ...ALL_FINANCE_ROLES]}><Payroll /></ProtectedRoute>} />
                <Route path="/hr/payroll/:runId" element={<ProtectedRoute requiredRole={['hr', 'admin', 'management', ...ALL_FINANCE_ROLES]}><PayrollRunDetail /></ProtectedRoute>} />
                <Route path="/hr/leave" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Leave /></ProtectedRoute>} />
                <Route path="/hr/attendance" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Attendance /></ProtectedRoute>} />
                <Route path="/hr/claims" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRClaims /></ProtectedRoute>} />
                <Route path="/hr/memos" element={<ProtectedRoute requiredRole={['hr', 'admin', 'management', ...ALL_FINANCE_ROLES]}><HRMemos /></ProtectedRoute>} />
                <Route path="/hr/org-chart" element={<ProtectedRoute requiredRole={['hr', ...MANAGEMENT_ROUTE_ROLES]}><OrgChart /></ProtectedRoute>} />


                {/* Finance routes */}
                <Route path="/finance/chart-of-accounts" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="/finance/setup/coa" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="/finance/setup/company-profile" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><SetupCompanyProfile /></ProtectedRoute>} />
                <Route path="/finance/setup/doa-matrix" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><SetupDoaMatrix /></ProtectedRoute>} />
                <Route path="/finance/masters/suppliers" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><MastersSuppliers /></ProtectedRoute>} />
                <Route path="/finance/masters/customers" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><MastersCustomers /></ProtectedRoute>} />
                <Route path="/finance/masters/bank-accounts" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><MastersBankAccounts /></ProtectedRoute>} />
                <Route path="/finance/workflow" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><Navigate to="/finance/workflow/inbox" replace /></ProtectedRoute>} />
                <Route path="/finance/workflow/inbox" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><WorkflowInbox /></ProtectedRoute>} />
                <Route path="/finance/gl/journal-entries" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><JournalEntries /></ProtectedRoute>} />
                <Route path="/finance/ap/prf" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><PurchaseRequisitions /></ProtectedRoute>} />
                <Route path="/finance/ap/invoices" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ApInvoices /></ProtectedRoute>} />
                <Route path="/finance/ap/payment-vouchers" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><PaymentVouchers /></ProtectedRoute>} />
                <Route path="/finance/ar/invoices" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ArInvoices /></ProtectedRoute>} />
                <Route path="/finance/ar/official-receipts" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><OfficialReceipts /></ProtectedRoute>} />
                <Route path="/finance/ap/notes" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ApDebitCreditNotes /></ProtectedRoute>} />
                <Route path="/finance/ar/notes" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ArDebitCreditNotes /></ProtectedRoute>} />
                <Route path="/finance/gl/cashbook" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><CashBook /></ProtectedRoute>} />
                <Route path="/finance/gl/opening-balance" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><OpeningBalance /></ProtectedRoute>} />
                <Route path="/finance/bank/reconciliation" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><BankReconciliation /></ProtectedRoute>} />
                <Route path="/finance/claims" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ClaimsPosting /></ProtectedRoute>} />
                <Route path="/finance/memos" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><FinanceMemos /></ProtectedRoute>} />
                <Route path="/finance/petty-cash" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><PettyCash /></ProtectedRoute>} />
                {/* <Route path="/finance/project-costing" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><ProjectCosting /></ProtectedRoute>} /> */}
                <Route path="/finance/wages" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><Wages /></ProtectedRoute>} />
                <Route path="/finance/reports" element={<ProtectedRoute requiredRole={[...FINANCE_ROUTE_ROLES]}><FinanceReports /></ProtectedRoute>} />

                {/* Management routes */}
                <Route path="/management/approve" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApproveOT /></ProtectedRoute>} />
                <Route path="/management/approve-leave" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApproveLeave /></ProtectedRoute>} />
                <Route path="/management/approve-claims" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApproveClaims /></ProtectedRoute>} />
                <Route path="/management/approve-payroll" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApprovePayroll /></ProtectedRoute>} />
                <Route path="/management/approve-prf" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApprovePRF /></ProtectedRoute>} />
                <Route path="/management/memo-approval" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApproveMemos /></ProtectedRoute>} />
                <Route path="/management/approve-pv" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ManagementApprovePV /></ProtectedRoute>} />
                <Route path="/management/report" element={<ProtectedRoute requiredRole={[...MANAGEMENT_ROUTE_ROLES]}><ReviewOT /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
                </Routes>
                  </Suspense>
                  <Toaster />
                  <Sonner />
                </AuthGuard>
              </ActiveRoleProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
