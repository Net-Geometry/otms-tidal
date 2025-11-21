import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { OTApprovalTable } from '@/components/approvals/OTApprovalTable';
import { useOTApproval } from '@/hooks/useOTApproval';
import { useManagementBulkApproval } from '@/hooks/useManagementBulkApproval';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const [activeTab, setActiveTab] = useState('hr_certified');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);

  const {
    requests,
    isLoading,
    approveRequest: approveRequestMutation,
    rejectRequest: rejectRequestMutation,
    isApproving,
    isRejecting
  } = useOTApproval({ role: 'management', status: activeTab });

  const { bulkApprove, isApproving: isBulkApproving } = useManagementBulkApproval();

  const filteredRequests = requests?.filter(request => {
    if (!searchQuery) return true;
    const profile = (request as any).profiles;
    const employeeName = profile?.full_name?.toLowerCase() || '';
    const employeeId = profile?.employee_id?.toLowerCase() || '';
    const department = (profile?.departments as any)?.name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return employeeName.includes(query) || employeeId.includes(query) || department.includes(query);
  }) || [];

  // Smart tab selection based on request status
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (requestId) {
      const fetchRequestStatus = async () => {
        const { data } = await supabase
          .from('ot_requests')
          .select('status')
          .eq('id', requestId)
          .maybeSingle();

        if (data) {
          const statusToTab: Record<string, string> = {
            'hr_certified': 'hr_certified',
            'management_approved': 'management_approved',
            'rejected': 'rejected',
          };

          const tab = statusToTab[data.status] || 'all';
          setActiveTab(tab);
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Management Approval</h1>
          <p className="text-muted-foreground">Review and approve overtime requests. Monthly approval cycle available.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="hr_certified">
          <TabsList>
            <TabsTrigger value="hr_certified">Pending Management Review</TabsTrigger>
            <TabsTrigger value="management_approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
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

                {/* Select All + Bulk Approve */}
                {activeTab === 'hr_certified' && filteredRequests.length > 0 && (
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
                  showActions={activeTab === 'hr_certified'}
                  initialSelectedRequestId={selectedRequestId}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
