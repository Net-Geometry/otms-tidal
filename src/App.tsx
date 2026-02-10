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

// Lazy load Finance routes
const ChartOfAccounts = lazy(() => import("./pages/finance/ChartOfAccounts"));
const ClaimsPosting = lazy(() => import("./pages/finance/ClaimsPosting"));
const PettyCash = lazy(() => import("./pages/finance/PettyCash"));
const ProjectCosting = lazy(() => import("./pages/finance/ProjectCosting"));
const Wages = lazy(() => import("./pages/finance/Wages"));
const FinanceReports = lazy(() => import("./pages/finance/FinanceReports"));

const ReviewOT = lazy(() => import("./pages/management/ReviewOT"));
const ManagementApproveOT = lazy(() => import("./pages/management/ApproveOT"));
const ManagementApproveLeave = lazy(() => import("./pages/management/ApproveLeave"));

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
                <Route path="/hr/dashboard" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRDashboard /></ProtectedRoute>} />
                <Route path="/finance/dashboard" element={<ProtectedRoute requiredRole={['finance', 'admin']}><FinanceDashboard /></ProtectedRoute>} />
                <Route path="/supervisor/dashboard" element={<ProtectedRoute requiredRole="supervisor"><SupervisorDashboard /></ProtectedRoute>} />
                <Route path="/employee/dashboard" element={<ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
                <Route path="/management/dashboard" element={<ProtectedRoute requiredRole={['management', 'admin']}><ManagementDashboard /></ProtectedRoute>} />
                
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
                <Route path="/hr/payroll" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Payroll /></ProtectedRoute>} />
                <Route path="/hr/leave" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Leave /></ProtectedRoute>} />
                <Route path="/hr/attendance" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Attendance /></ProtectedRoute>} />
                <Route path="/hr/claims" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRClaims /></ProtectedRoute>} />

                {/* Finance routes */}
                <Route path="/finance/chart-of-accounts" element={<ProtectedRoute requiredRole={['finance', 'admin']}><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="/finance/claims" element={<ProtectedRoute requiredRole={['finance', 'admin']}><ClaimsPosting /></ProtectedRoute>} />
                <Route path="/finance/petty-cash" element={<ProtectedRoute requiredRole={['finance', 'admin']}><PettyCash /></ProtectedRoute>} />
                <Route path="/finance/project-costing" element={<ProtectedRoute requiredRole={['finance', 'admin']}><ProjectCosting /></ProtectedRoute>} />
                <Route path="/finance/wages" element={<ProtectedRoute requiredRole={['finance', 'admin']}><Wages /></ProtectedRoute>} />
                <Route path="/finance/reports" element={<ProtectedRoute requiredRole={['finance', 'admin']}><FinanceReports /></ProtectedRoute>} />

                {/* Management routes */}
                <Route path="/management/approve" element={<ProtectedRoute requiredRole={['management', 'admin']}><ManagementApproveOT /></ProtectedRoute>} />
                <Route path="/management/approve-leave" element={<ProtectedRoute requiredRole={['management', 'admin']}><ManagementApproveLeave /></ProtectedRoute>} />
                <Route path="/management/report" element={<ProtectedRoute requiredRole={['management', 'admin']}><ReviewOT /></ProtectedRoute>} />
                
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
