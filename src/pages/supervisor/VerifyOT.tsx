import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTApprovalTable } from '@/components/approvals/OTApprovalTable';
import { useOTApproval } from '@/hooks/useOTApproval';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function VerifyOT() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'rejected' | 'all'>('pending'); // Consolidated "pending" filter
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const { user } = useAuth();

  const {
    requests: allRequests,
    isLoading,
    approveRequest: approveRequestMutation,
    rejectRequest: rejectRequestMutation,
    confirmRequest: confirmRequestMutation,
    confirmRespectiveSupervisor: confirmRespectiveSupervisorMutation,
    denyRespectiveSupervisor: denyRespectiveSupervisorMutation,
    reviseDeniedRequest: reviseDeniedRequestMutation,
    isApproving,
    isRejecting,
    isConfirming,
    isConfirmingRespectiveSupervisor,
    isDenyingRespectiveSupervisor,
    isRevisingDeniedRequest
  } = useOTApproval({ role: 'supervisor', status: 'all' });

  // Filter requests by consolidated status tab
  const filterRequestsByTab = (requests: typeof allRequests, tab: string) => {
    if (tab === 'all') return requests;

    const pendingStatuses = ['pending_verification', 'pending_supervisor_verification', 'pending_respective_supervisor_confirmation'];
    const completedStatuses = ['supervisor_confirmed', 'supervisor_verified', 'respective_supervisor_confirmed', 'hr_certified', 'management_approved'];
    const rejectedStatuses = ['rejected'];

    let filtered = requests;

    switch (tab) {
      case 'pending':
        filtered = requests.filter(r => pendingStatuses.includes(r.status));
        // Filter based on supervisor role
        if (user?.id) {
          filtered = filtered.filter(r => {
            const isDirectSupervisor = (r as any).supervisor_id === user.id;
            const isRespecttiveSupervisor = (r as any).respective_supervisor_id === user.id;

            // If they're only the respective supervisor (not direct), only show if awaiting their confirmation
            if (isRespecttiveSupervisor && !isDirectSupervisor) {
              return r.status === 'pending_respective_supervisor_confirmation';
            }

            // If they're the direct supervisor but NOT the respective supervisor,
            // hide pending_respective_supervisor_confirmation requests
            if (isDirectSupervisor && !isRespecttiveSupervisor &&
                r.status === 'pending_respective_supervisor_confirmation') {
              return false;
            }

            return true;
          });
        }
        return filtered;
      case 'completed':
        return requests.filter(r => completedStatuses.includes(r.status));
      case 'rejected':
        return requests.filter(r => rejectedStatuses.includes(r.status));
      default:
        return requests;
    }
  };

  const requests = filterRequestsByTab(allRequests, statusFilter);

  // Wrapper functions to match the expected API
  const approveRequest = async (requestIds: string[], remarks?: string) => {
    await approveRequestMutation({ requestIds, remarks });
  };

  const rejectRequest = async (requestIds: string[], remarks: string) => {
    await rejectRequestMutation({ requestIds, remarks });
  };

  const confirmRequest = async (requestIds: string[], remarks?: string) => {
    await confirmRequestMutation({ requestIds, remarks });
  };

  const confirmRespectiveSupervisor = async (requestIds: string[], remarks?: string) => {
    await confirmRespectiveSupervisorMutation({ requestIds, remarks });
  };

  const denyRespectiveSupervisor = async (requestIds: string[], denialRemarks: string) => {
    await denyRespectiveSupervisorMutation({ requestIds, denialRemarks });
  };

  const reviseDeniedRequest = async (requestIds: string[], remarks?: string) => {
    await reviseDeniedRequestMutation({ requestIds, remarks });
  };

  const filteredRequests = requests?.filter(request => {
    if (!searchQuery) return true;
    const profile = (request as any).profiles;
    const employeeName = profile?.full_name?.toLowerCase() || '';
    const employeeId = profile?.employee_id?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return employeeName.includes(query) || employeeId.includes(query);
  }) || [];

  // Helper function to determine which "logical" tab a request belongs to
  const getTabForStatus = (status: string): string => {
    const pendingStatuses = [
      'pending_verification',
      'pending_supervisor_verification',
      'pending_respective_supervisor_confirmation'
    ];
    const completedStatuses = ['supervisor_confirmed', 'supervisor_verified', 'respective_supervisor_confirmed', 'hr_certified', 'management_approved'];
    const rejectedStatuses = ['rejected'];

    if (pendingStatuses.includes(status)) return 'pending';
    if (completedStatuses.includes(status)) return 'completed';
    if (rejectedStatuses.includes(status)) return 'rejected';
    return 'all';
  };

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
          setStatusFilter(getTabForStatus(data.status));
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
  }, [searchParams, requests, setSearchParams]);

  return (
    <AppLayout>
      <PageLayout
        title="Verify OT Requests"
        description="Review and verify overtime requests from your team"
      >

        <Card className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending">
                  <span>⏳ Awaiting My Action</span>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  <span>✓ Completed</span>
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  <span>⚠ Rejected</span>
                </TabsTrigger>
                <TabsTrigger value="all">
                  <span>📋 All</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-4">
                <OTApprovalTable
                  requests={filteredRequests}
                  isLoading={isLoading}
                  role="supervisor"
                  currentUserId={user?.id}
                  approveRequest={approveRequest}
                  rejectRequest={rejectRequest}
                  confirmRequest={confirmRequest}
                  confirmRespectiveSupervisor={confirmRespectiveSupervisor}
                  denyRespectiveSupervisor={denyRespectiveSupervisor}
                  reviseDeniedRequest={reviseDeniedRequest}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                  isConfirming={isConfirming}
                  isConfirmingRespectiveSupervisor={isConfirmingRespectiveSupervisor}
                  isDenyingRespectiveSupervisor={isDenyingRespectiveSupervisor}
                  isRevisingDeniedRequest={isRevisingDeniedRequest}
                  showApprovalHistory={statusFilter === 'completed'}
                  initialSelectedRequestId={selectedRequestId}
                />
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
