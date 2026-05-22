import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { OTApprovalTable } from '@/components/approvals/OTApprovalTable';
import { useOTApproval } from '@/hooks/useOTApproval';
import { useManagementBulkApproval } from '@/hooks/useManagementBulkApproval';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportToXLSX } from '@/lib/xlsxExport';
import { buildOTManagementExportRows } from '@/lib/otManagementExport';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

export default function ApproveOT() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam || 'pending'; // Consolidated to "pending"
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const {
    requests,
    isLoading,
    approveRequest: approveRequestMutation,
    rejectRequest: rejectRequestMutation,
    isApproving,
    isRejecting
  } = useOTApproval({ role: 'management' });

  const { bulkApprove, isApproving: isBulkApproving } = useManagementBulkApproval();

  // Helper function to determine which "logical" tab a request belongs to
  // For hr_certified requests, checks management_remarks to determine if rejected
  const getTabForStatus = (status: string, hasManagementRemarks?: boolean): string => {
    const approvedStatuses = ['management_approved'];

    if (status === 'hr_certified') {
      // hr_certified with management_remarks = rejected (sent back to HR)
      // hr_certified without management_remarks = pending approval
      return hasManagementRemarks ? 'rejected' : 'pending';
    }
    if (approvedStatuses.includes(status)) return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'all';
  };

  // Filter requests by consolidated status tab
  const filterRequestsByTab = (requests: typeof requests, tab: string) => {
    if (tab === 'all') return requests;

    const approvedStatuses = ['management_approved'];

    switch (tab) {
      case 'pending':
        // Show hr_certified requests that do NOT have management_remarks (not yet rejected)
        return requests.filter(r => r.status === 'hr_certified' && !r.management_remarks);
      case 'approved':
        return requests.filter(r => approvedStatuses.includes(r.status));
      case 'rejected':
        // Show fully rejected requests AND hr_certified requests with management_remarks (sent back to HR)
        return requests.filter(r => r.status === 'rejected' || (r.status === 'hr_certified' && r.management_remarks));
      default:
        return requests;
    }
  };

  const requestsByTab = filterRequestsByTab(requests || [], activeTab);
  const filteredRequests = requestsByTab?.filter(request => {
    const requestDate = request.ot_date;
    if (dateRange?.start && requestDate < dateRange.start) return false;
    if (dateRange?.end && requestDate > dateRange.end) return false;

    const profile = (request as any).profiles;
    if (departmentFilter && (profile?.departments as any)?.name !== departmentFilter) return false;

    if (!searchQuery) return true;
    const employeeName = profile?.full_name?.toLowerCase() || '';
    const employeeId = profile?.employee_id?.toLowerCase() || '';
    const department = (profile?.departments as any)?.name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return employeeName.includes(query) || employeeId.includes(query) || department.includes(query);
  }) || [];

  const handleExportVisibleExcel = async () => {
    if (filteredRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'No OT submissions match the current tab and filters.',
        variant: 'destructive',
      });
      return;
    }

    const headers = getOTSubmissionExportHeaders();
    const rows = buildOTManagementExportRows(filteredRequests as any[]);
    const rangeLabel = dateRange?.start || dateRange?.end
      ? `${dateRange?.start || 'start'}_to_${dateRange?.end || 'end'}`
      : activeTab;

    await exportToXLSX(rows, `OT_Management_Submissions_${rangeLabel}`, headers, {
      reportName: 'OT Management Submissions',
      period: dateRange?.start || dateRange?.end
        ? `${dateRange?.start || 'Start'} to ${dateRange?.end || 'End'}`
        : `Tab: ${activeTab}`,
      generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm'),
    });

    toast({
      title: 'Export generated',
      description: 'OT submissions Excel file has been downloaded.',
    });
  };

  const handleExportAllSubmissionsExcel = async () => {
    setIsExporting(true);
    try {
      let query = supabase
        .from('ot_requests')
        .select(`
          *,
          profiles!ot_requests_employee_id_fkey(
            employee_id,
            full_name,
            department_id,
            company_id,
            departments!profiles_department_id_fkey(name),
            companies!profiles_company_id_fkey(name, code)
          )
        `)
        .order('ot_date', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('ot_date', dateRange.start);
      }

      if (dateRange?.end) {
        query = query.lte('ot_date', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;

      const queryText = searchQuery.trim().toLowerCase();
      const exportRequests = (data || [])
        .map((request: any) => ({
          ...request,
          sessions: [{
            start_time: request.start_time,
            end_time: request.end_time,
            total_hours: request.total_hours,
          }],
        }))
        .filter((request: any) => {
          const profile = request.profiles;
          if (departmentFilter && profile?.departments?.name !== departmentFilter) return false;
          if (!queryText) return true;

          const employeeName = profile?.full_name?.toLowerCase() || '';
          const employeeId = profile?.employee_id?.toLowerCase() || '';
          const department = profile?.departments?.name?.toLowerCase() || '';
          const company = profile?.companies?.name?.toLowerCase() || '';
          const ticketNumber = request.ticket_number?.toLowerCase() || '';

          return (
            employeeName.includes(queryText) ||
            employeeId.includes(queryText) ||
            department.includes(queryText) ||
            company.includes(queryText) ||
            ticketNumber.includes(queryText)
          );
        });

      if (exportRequests.length === 0) {
        toast({
          title: 'No data to export',
          description: 'No OT submissions match the current filters.',
          variant: 'destructive',
        });
        return;
      }

      const headers = getOTSubmissionExportHeaders();

      const rows = buildOTManagementExportRows(exportRequests);
      const rangeLabel = dateRange?.start || dateRange?.end
        ? `${dateRange?.start || 'start'}_to_${dateRange?.end || 'end'}`
        : 'all_periods';

      await exportToXLSX(rows, `OT_All_Submissions_${rangeLabel}`, headers, {
        reportName: 'All OT Submissions',
        period: dateRange?.start || dateRange?.end
          ? `${dateRange?.start || 'Start'} to ${dateRange?.end || 'End'}`
          : 'All Periods',
        generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm'),
      });

      toast({
        title: 'Export generated',
        description: 'All OT submissions Excel file has been downloaded.',
      });
    } catch (error) {
      console.error('OT submissions export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Unable to export OT submissions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Smart tab selection based on request status
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (requestId) {
      const fetchRequestStatus = async () => {
        const { data } = await supabase
          .from('ot_requests')
          .select('status, management_remarks')
          .eq('id', requestId)
          .maybeSingle();

        if (data) {
          setActiveTab(getTabForStatus(data.status, !!data.management_remarks));
        }
      };

      fetchRequestStatus();
    }
  }, [searchParams]);

  // Auto-open request from URL parameter
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (requestId && requests && requests.length > 0) {
      setSelectedRequestId(requestId);
      // Clear the parameter after opening
      searchParams.delete('request');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, requests, setSearchParams, activeTab]);

  const handleApprove = async (requestIds: string[], remarks?: string) => {
    await approveRequestMutation({ requestIds, remarks });
  };

  const handleReject = async (requestIds: string[], remarks: string) => {
    await rejectRequestMutation({ requestIds, remarks });
  };

  const selectedRequestIds = selectAll ? filteredRequests.map(r => r.id) : [];

  const handleBulkApprove = async () => {
    if (selectedRequestIds.length === 0) return;
    await bulkApprove(selectedRequestIds);
    setSelectAll(false);
    setShowBulkConfirmation(false);
  };

  // Get unique departments for filter
  const departments = Array.from(new Set(
    (requests || []).map(r => (r as any).profiles?.departments?.name).filter(Boolean)
  ));

  return (
    <AppLayout>
      <PageLayout
        title="Management Approval"
        description="Review and approve overtime requests. Monthly approval cycle available."
      >

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="pending">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">
              <span>⏳ Awaiting Approval</span>
            </TabsTrigger>
            <TabsTrigger value="approved">
              <span>✓ Approved</span>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <span>⚠ Rejected</span>
            </TabsTrigger>
            <TabsTrigger value="all">
              <span>📋 All</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card className="p-6">
              <div className="space-y-4">
                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by employee or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Date Range Start */}
                  <Input
                    type="date"
                    placeholder="Start date"
                    onChange={(e) => setDateRange(prev => ({ ...prev || { start: '', end: '' }, start: e.target.value }))}
                  />

                  {/* Date Range End */}
                  <Input
                    type="date"
                    placeholder="End date"
                    onChange={(e) => setDateRange(prev => ({ ...prev || { start: '', end: '' }, end: e.target.value }))}
                  />
                </div>

                {/* Department Filter */}
                <div className="flex items-center gap-2 pb-4">
                  <label className="text-sm font-medium">Department:</label>
                  <Select value={departmentFilter || 'all'} onValueChange={(value) => setDepartmentFilter(value === 'all' ? null : value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept || 'all'}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pb-4">
                  <Button
                    variant="outline"
                    onClick={handleExportVisibleExcel}
                    disabled={isLoading || filteredRequests.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Current View Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportAllSubmissionsExcel}
                    disabled={isExporting}
                    className="ml-2"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? 'Exporting...' : 'Export All Submissions Excel'}
                  </Button>
                </div>

                {/* Select All + Bulk Approve */}
                {activeTab === 'pending' && filteredRequests.length > 0 && (
                  <div className="flex items-center gap-4 pb-4 bg-blue-50 dark:bg-slate-900 p-4 rounded-lg border border-blue-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="selectAll"
                        checked={selectAll}
                        onChange={(e) => setSelectAll(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer dark:text-slate-200">
                        Select all ({filteredRequests.length} pending)
                      </label>
                    </div>
                    <Button
                      onClick={() => setShowBulkConfirmation(true)}
                      disabled={!selectAll || isBulkApproving}
                      className="ml-auto gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Approve All
                    </Button>
                  </div>
                )}

                <OTApprovalTable
                  requests={filteredRequests}
                  isLoading={isLoading}
                  role="management"
                  approveRequest={handleApprove}
                  rejectRequest={handleReject}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                  showActions={activeTab === 'pending'}
                  initialSelectedRequestId={selectedRequestId}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </PageLayout>

      {/* Bulk Approval Confirmation Dialog */}
      <Dialog open={showBulkConfirmation} onOpenChange={setShowBulkConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Approval</DialogTitle>
            <DialogDescription>
              Review the summary before approving all selected overtime requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-slate-900 p-4 rounded-lg space-y-2 border border-blue-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="font-medium dark:text-slate-200">Total OTs to Approve:</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedRequestIds.length}</span>
              </div>

              {dateRange?.start && dateRange?.end && (
                <div className="flex justify-between text-sm dark:text-slate-300">
                  <span>Date Range:</span>
                  <span>{format(new Date(dateRange.start), 'MMM dd, yyyy')} - {format(new Date(dateRange.end), 'MMM dd, yyyy')}</span>
                </div>
              )}

              {departmentFilter && (
                <div className="flex justify-between text-sm dark:text-slate-300">
                  <span>Department:</span>
                  <span>{departmentFilter}</span>
                </div>
              )}

              <div className="flex justify-between text-sm pt-2 border-t border-blue-200 dark:border-slate-600 dark:text-slate-300">
                <span>Employees Affected:</span>
                <span className="font-medium">
                  {new Set(
                    filteredRequests.map(r => (r as any).profiles?.full_name)
                  ).size}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This action will mark all selected OT requests as management approved. Employees will be notified of approval.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkConfirmation(false)}
              disabled={isBulkApproving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="gap-2"
            >
              {isBulkApproving && <span className="inline-block animate-spin">⌛</span>}
              {isBulkApproving ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function getOTSubmissionExportHeaders() {
  return [
    { key: 'ticket_number', label: 'Ticket #' },
    { key: 'employee_no', label: 'Employee No.' },
    { key: 'employee_name', label: 'Employee Name' },
    { key: 'company', label: 'Company' },
    { key: 'department', label: 'Department' },
    { key: 'ot_date', label: 'OT Date' },
    { key: 'sessions', label: 'Submitted OT Sessions' },
    { key: 'total_hours', label: 'Total OT Hours' },
    { key: 'ot_amount', label: 'OT Amount (RM)' },
    { key: 'current_status', label: 'Current Status' },
    { key: 'included_in_claim', label: 'Included In Claim' },
    { key: 'claim_amount', label: 'Claim Amount (RM)' },
    { key: 'supervisor_date', label: 'Supervisor Date' },
    { key: 'respective_supervisor_date', label: 'Respective Supervisor Date' },
    { key: 'hr_certified_date', label: 'HR Certified Date' },
    { key: 'management_approved_date', label: 'Management Approved Date' },
    { key: 'rejection_stage', label: 'Rejection Stage' },
    { key: 'remarks', label: 'Remarks' },
  ];
}
