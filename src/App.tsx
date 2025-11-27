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

// Lazy load supervisor routes
const VerifyOT = lazy(() => import("./pages/supervisor/VerifyOT"));

// Lazy load HR routes
const ApproveOT = lazy(() => import("./pages/hr/ApproveOT"));
const Employees = lazy(() => import("./pages/hr/Employees"));
const ArchivedEmployees = lazy(() => import("./pages/hr/ArchivedEmployees"));
const Departments = lazy(() => import("./pages/hr/Departments"));
const HRSettings = lazy(() => import("./pages/hr/Settings"));
const OTReports = lazy(() => import("./pages/hr/OTReports"));
const HolidayCalendars = lazy(() => import("./pages/hr/HolidayCalendars"));
const NewHolidayCalendar = lazy(() => import("./pages/hr/NewHolidayCalendar"));
const EditHolidayCalendar = lazy(() => import("./pages/hr/EditHolidayCalendar"));

const ReviewOT = lazy(() => import("./pages/management/ReviewOT"));
const ManagementApproveOT = lazy(() => import("./pages/management/ApproveOT"));

const queryClient = createQueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="ot-scribe-theme">
      <QueryClientProvider client={queryClient}>
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
                
                {/* Supervisor routes */}
                <Route path="/supervisor/verify" element={<ProtectedRoute requiredRole="supervisor"><VerifyOT /></ProtectedRoute>} />
                
                {/* HR routes */}
                <Route path="/hr/approve" element={<ProtectedRoute requiredRole={['hr', 'admin']}><ApproveOT /></ProtectedRoute>} />
                <Route path="/hr/employees" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Employees /></ProtectedRoute>} />
                <Route path="/hr/employees/archived" element={<ProtectedRoute requiredRole={['hr', 'admin']}><ArchivedEmployees /></ProtectedRoute>} />
                <Route path="/hr/departments" element={<ProtectedRoute requiredRole={['hr', 'admin']}><Departments /></ProtectedRoute>} />
                <Route path="/hr/calendar" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HolidayCalendars /></ProtectedRoute>} />
                <Route path="/hr/calendar/new" element={<ProtectedRoute requiredRole={['hr', 'admin']}><NewHolidayCalendar /></ProtectedRoute>} />
                <Route path="/hr/calendar/:id/edit" element={<ProtectedRoute requiredRole={['hr', 'admin']}><EditHolidayCalendar /></ProtectedRoute>} />
                <Route path="/hr/holidays" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HolidayManagement /></ProtectedRoute>} />
                <Route path="/hr/settings" element={<ProtectedRoute requiredRole={['hr', 'admin']}><HRSettings /></ProtectedRoute>} />
                <Route path="/hr/ot-reports" element={<ProtectedRoute requiredRole={['hr', 'admin']}><OTReports /></ProtectedRoute>} />

                {/* Management routes */}
                <Route path="/management/approve" element={<ProtectedRoute requiredRole={['management', 'admin']}><ManagementApproveOT /></ProtectedRoute>} />
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
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
