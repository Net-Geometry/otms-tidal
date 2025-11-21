import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OTApprovalTable } from '@/components/approvals/OTApprovalTable';
import { OTApprovalDetailsSheet } from '@/components/approvals/OTApprovalDetailsSheet';
import { OTApprovalDetailsSheet as RecertifyDetailsSheet } from '@/components/hr/approve/OTApprovalDetailsSheet';
import { useOTApproval } from '@/hooks/useOTApproval';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePendingRecertifications, useRecertifyOTActions } from '@/hooks/hr/useRecertifyOT';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function ApproveOT() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam || 'supervisor_verified';
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [recertifyDetailsRequest, setRecertifyDetailsRequest] = useState<any>(null);
  const [recertifySelectedRequest, setRecertifySelectedRequest] = useState<any>(null);
  const [recertifyAction, setRecertifyAction] = useState<'recertify' | 'decline' | null>(null);
  const [recertifyRemarks, setRecertifyRemarks] = useState('');
  const [recertifyDialogOpen, setRecertifyDialogOpen] = useState(false);
  
  const { 
    requests, 
    isLoading, 
    approveRequest: approveRequestMutation, 
    rejectRequest: rejectRequestMutation,
    isApproving,
    isRejecting
  } = useOTApproval({ role: 'hr', status: activeTab === 'pending_hr_recertification' ? 'supervisor_verified' : activeTab });

  const { data: recertifyRequests = [], isLoading: isLoadingRecertify } = usePendingRecertifications();
  const recertifyActions = useRecertifyOTActions();

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
            'supervisor_verified': 'supervisor_verified',
            'hr_certified': 'hr_certified',
            'rejected': 'rejected',
            'pending_hr_recertification': 'pending_hr_recertification',
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

  const handleRecertifyAction = (request: any, actionType: 'recertify' | 'decline') => {
    setRecertifySelectedRequest(request);
    setRecertifyAction(actionType);
    setRecertifyRemarks('');
    setRecertifyDialogOpen(true);
  };

  const handleRecertifySubmit = async () => {
    if (!recertifySelectedRequest || !recertifyAction || !recertifyRemarks.trim()) return;

    if (recertifyAction === 'recertify') {
      await recertifyActions.recertify.mutateAsync({ requestId: recertifySelectedRequest.id, remarks: recertifyRemarks });
    } else {
      await recertifyActions.decline.mutateAsync({ requestId: recertifySelectedRequest.id, remarks: recertifyRemarks });
    }

    setRecertifyDialogOpen(false);
    setRecertifySelectedRequest(null);
    setRecertifyAction(null);
    setRecertifyRemarks('');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Certify OT Requests</h1>
          <p className="text-muted-foreground">Certify overtime requests that have been verified by supervisors</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="supervisor_verified">
          <TabsList>
            <TabsTrigger value="supervisor_verified">Pending Certification</TabsTrigger>
            <TabsTrigger value="hr_certified">Certified</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending_hr_recertification">
              Recertify {recertifyRequests.length > 0 && `(${recertifyRequests.length})`}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'pending_hr_recertification' ? (
            <TabsContent value="pending_hr_recertification" className="mt-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      These OT requests were rejected by Management. You can either:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li><strong>Recertify</strong>: Send back to Management for review with your justification</li>
                        <li><strong>Decline</strong>: Send back to employee for corrections</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  {isLoadingRecertify ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recertifyRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending recertification requests
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Submitted OT Sessions</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Management Remarks</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recertifyRequests.map((request: any) => {
                          const profile = request.profiles;
                          const department = profile?.departments;
                          const sessions = request.ot_sessions || [];
                          return (
                            <TableRow 
                              key={request.id}
                              className="hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setRecertifyDetailsRequest(request)}
                            >
                              <TableCell>
                                <div className="font-medium">{profile?.full_name}</div>
                                <div className="text-xs text-muted-foreground">{department?.name}</div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{profile?.employee_id}</TableCell>
                              <TableCell>{format(new Date(request.ot_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {request.start_time && request.end_time ? (
                      <span>
                        {format(new Date(`2000-01-01T${request.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${request.end_time}`), 'h:mm a')} ({request.total_hours}h)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{request.total_hours}h total</span>
                    )}
                  </div>
                </TableCell>
                              <TableCell className="font-medium">{request.total_hours}h</TableCell>
                              <TableCell>
                                <div className="text-sm max-w-xs">
                                  {request.management_remarks || '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleRecertifyAction(request, 'recertify')}
                                    disabled={recertifyActions.recertify.isPending || recertifyActions.decline.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Recertify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRecertifyAction(request, 'decline')}
                                    disabled={recertifyActions.recertify.isPending || recertifyActions.decline.isPending}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Decline
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Card>
            </TabsContent>
          ) : (
            <TabsContent value={activeTab} className="mt-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by employee, department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <OTApprovalTable 
                    requests={filteredRequests} 
                    isLoading={isLoading}
                    role="hr"
                    approveRequest={handleApprove}
                    rejectRequest={handleReject}
                    isApproving={isApproving}
                    isRejecting={isRejecting}
                    showActions={activeTab === 'supervisor_verified'}
                    initialSelectedRequestId={selectedRequestId}
                  />
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={recertifyDialogOpen} onOpenChange={setRecertifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {recertifyAction === 'recertify' ? 'Recertify OT Request' : 'Decline OT Request'}
              </DialogTitle>
              <DialogDescription>
                {recertifyAction === 'recertify' 
                  ? 'You are recertifying this request to send it back to Management for review. Please provide your justification.'
                  : 'You are declining this request to send it back to the employee for corrections. Please explain what needs to be fixed.'}
              </DialogDescription>
            </DialogHeader>

            {recertifySelectedRequest && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Management Rejection Reason:</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                    {recertifySelectedRequest.management_remarks || 'No remarks provided'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recertify-remarks">Your Remarks *</Label>
                  <Textarea
                    id="recertify-remarks"
                    placeholder={recertifyAction === 'recertify' 
                      ? 'Explain why this should be recertified...'
                      : 'Explain what the employee needs to correct...'}
                    value={recertifyRemarks}
                    onChange={(e) => setRecertifyRemarks(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setRecertifyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRecertifySubmit}
                disabled={!recertifyRemarks.trim() || recertifyActions.recertify.isPending || recertifyActions.decline.isPending}
                variant={recertifyAction === 'recertify' ? 'default' : 'destructive'}
              >
                {recertifyAction === 'recertify' ? 'Recertify' : 'Decline'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <RecertifyDetailsSheet
          request={recertifyDetailsRequest}
          open={!!recertifyDetailsRequest}
          onOpenChange={(open) => !open && setRecertifyDetailsRequest(null)}
          showRecertifyActions={true}
          onRecertify={(requestId, remarks) => {
            recertifyActions.recertify.mutate({ requestId, remarks });
            setRecertifyDetailsRequest(null);
          }}
          onDecline={(requestId, remarks) => {
            recertifyActions.decline.mutate({ requestId, remarks });
            setRecertifyDetailsRequest(null);
          }}
          isRecertifying={recertifyActions.recertify.isPending}
          isDeclining={recertifyActions.decline.isPending}
        />
      </div>
    </AppLayout>
  );
}
