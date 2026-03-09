export const generateBreadcrumbs = (pathname: string) => {
  const paths = pathname.split('/').filter(Boolean);
  
  const breadcrumbLabels: Record<string, string> = {
    'admin': 'Admin',
    'hr': 'HR',
    'finance': 'Finance',
    'supervisor': 'Supervisor',
    'employee': 'Employee',
    'sgm': 'Senior General Manager',
    'management': 'Management',
    'director': 'Director',
    'gm': 'General Manager',
    'head_finance': 'Head of Finance',
    'account_assistant': 'Account Assistant',
    'assistant_manager': 'Assistant Manager',
    'manager': 'Manager',
    'dmd': 'Deputy Manager Director',
    'account_exec': 'Account Executive',
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
    'prf': 'Payment Requisitions',
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
    'wages': 'Wages',
    'ot-reports': 'OT Reports',
    'org-chart': 'Organization Chart',
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

  const parentRedirects: Record<string, string> = {
    '/employee': '/employee/dashboard',
    '/hr': '/hr/dashboard',
    '/finance': '/finance/dashboard',
    '/supervisor': '/supervisor/dashboard',
    '/management': '/management/dashboard',
    '/admin': '/admin/dashboard',
  };

  return paths
    .filter((path, index) => {
      if (index > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) {
        return false;
      }
      if (index > 0 && /^\d+$/.test(path)) {
        return false;
      }
      return true;
    })
    .map((path, index, filteredPaths) => {
      const originalIndex = paths.indexOf(path);
      const fullPath = '/' + paths.slice(0, originalIndex + 1).join('/');
      const linkPath = parentRedirects[fullPath] || fullPath;

      const prevSeg = originalIndex > 0 ? paths[originalIndex - 1] : null;
      let label = breadcrumbLabels[path] || path.charAt(0).toUpperCase() + path.slice(1);
      if (path === 'history' && prevSeg === 'ot') label = 'OT History';
      if (path === 'history' && prevSeg === 'leave') label = 'Leave History';
      if (path === 'history' && prevSeg === 'attendance') label = 'Attendance History';
      if (path === 'history' && prevSeg === 'claims') label = 'Claim History';
      if (path === 'submit' && prevSeg === 'claims') label = 'Submit Claim';
      if (path === 'invoices' && prevSeg === 'ap') label = 'AP Invoices';
      if (path === 'invoices' && prevSeg === 'ar') label = 'AR Invoices';

      return { path: linkPath, label, isLast: index === filteredPaths.length - 1 };
    });
};
