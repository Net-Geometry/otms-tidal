import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTApprovalTable } from '@/components/approvals/OTApprovalTable';
import { useOTApproval } from '@/hooks/useOTApproval';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function VerifyOT() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_verification');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  
  const { 
    requests, 
    isLoading, 
    approveRequest: approveRequestMutation, 
    rejectRequest: rejectRequestMutation,
    confirmRequest: confirmRequestMutation,
    isApproving,
    isRejecting,
    isConfirming
  } = useOTApproval({ role: 'supervisor', status: statusFilter });

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

  const filteredRequests = requests?.filter(request => {
    if (!searchQuery) return true;
    const profile = (request as any).profiles;
    const employeeName = profile?.full_name?.toLowerCase() || '';
    const employeeId = profile?.employee_id?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return employeeName.includes(query) || employeeId.includes(query);
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
            'pending_verification': 'pending_verification',
            'supervisor_verified': 'completed',
            'rejected': 'rejected',
          };
          
          const tab = statusToTab[data.status] || 'all';
          setStatusFilter(tab);
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
  }, [searchParams, requests, setSearchParams, statusFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Verify OT Requests</h1>
          <p className="text-muted-foreground">Review and verify overtime requests from your team</p>
        </div>

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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pending_verification">Pending</TabsTrigger>
                <TabsTrigger value="pending_supervisor_confirmation">Confirm</TabsTrigger>
                <TabsTrigger value="completed">Verified</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-4">
                <OTApprovalTable 
                  requests={filteredRequests} 
                  isLoading={isLoading}
                  role="supervisor"
                  approveRequest={approveRequest}
                  rejectRequest={rejectRequest}
                  confirmRequest={confirmRequest}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                  isConfirming={isConfirming}
                  initialSelectedRequestId={selectedRequestId}
                />
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
