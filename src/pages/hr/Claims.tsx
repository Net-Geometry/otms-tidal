import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ClipboardList, DollarSign, Download, Search, Settings2 } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { ClaimRequestTable } from '@/components/claims/ClaimRequestTable';
import { ClaimTypeSetup } from '@/components/claims/ClaimTypeSetup';
import { useClaimApproval, type ClaimApprovalTab } from '@/hooks/claims/useClaimApproval';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/otCalculations';

export default function Claims() {
  const [section, setSection] = useState<'requests' | 'types'>('requests');
  const [tab, setTab] = useState<ClaimApprovalTab>('pending');
  const [search, setSearch] = useState('');
  const [claimTypeFilter, setClaimTypeFilter] = useState<string>('all');

  const approval = useClaimApproval({ role: 'hr', tab });

  // Get unique claim types for filter dropdown
  const claimTypes = useMemo(() => {
    const types = new Map<string, string>();
    for (const r of approval.data || []) {
      const id = r.claim_type_id || '';
      const name = r.claim_type?.name || '';
      if (id && name) types.set(id, name);
    }
    return Array.from(types.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [approval.data]);

  const filtered = useMemo(() => {
    let rows = approval.data || [];

    // Filter by claim type
    if (claimTypeFilter !== 'all') {
      rows = rows.filter((r) => r.claim_type_id === claimTypeFilter);
    }

    // Filter by search text
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const name = r.profiles?.full_name || '';
        const type = r.claim_type?.name || '';
        return (
          r.ticket_number?.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q)
        );
      });
    }

    return rows;
  }, [approval.data, search, claimTypeFilter]);

  const { data: stats } = useQuery({
    queryKey: ['claims-hr-stats'],
    queryFn: async () => {
      const db = supabase as any;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await db
        .from('claims')
        .select('status, amount, created_at')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;

      const pendingHr = (data || []).filter((r: any) => r.status === 'pending_hr').length;
      const approvedCount = (data || []).filter((r: any) => r.status === 'hr_approved').length;
      const approvedAmount = (data || [])
        .filter((r: any) => r.status === 'hr_approved')
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      return { pendingHr, approvedCount, approvedAmount };
    },
    staleTime: 30 * 1000,
  });

  return (
    <AppLayout>
      <PageLayout title="Claims Management" description="Claims requests, approvals, and claim type setup.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pending (HR)"
            value={String(stats?.pendingHr ?? '-')}
            subtitle="Awaiting HR processing"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Approved Amount (Month)"
            value={stats ? formatCurrency(Number(stats.approvedAmount)) : '-'}
            subtitle={stats ? `${stats.approvedCount} approved` : 'This month'}
            icon={DollarSign}
          />
        </div>

        <Tabs value={section} onValueChange={(v) => setSection(v as any)} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Claim Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
            <Card className="p-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClaimApprovalTab)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={tab} className="mt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by ticket, employee, or type..."
                        className="pl-9"
                      />
                    </div>
                    <Select value={claimTypeFilter} onValueChange={setClaimTypeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {claimTypes.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filtered.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const headers = [
                            { key: 'ticket_number', label: 'Ticket' },
                            { key: 'employee_name', label: 'Employee' },
                            { key: 'claim_type', label: 'Type' },
                            { key: 'claim_date', label: 'Date' },
                            { key: 'amount', label: 'Amount (RM)' },
                            { key: 'status', label: 'Status' },
                            { key: 'purpose', label: 'Purpose' },
                          ];
                          const data = filtered.map((r) => ({
                            ticket_number: r.ticket_number,
                            employee_name: r.profiles?.full_name || r.employee_id,
                            claim_type: r.claim_type?.name || '',
                            claim_date: r.claim_date,
                            amount: Number(r.amount || 0).toFixed(2),
                            status: r.status,
                            purpose: r.purpose || '',
                          }));
                          exportToCSV(data, `Claims_${tab}_${new Date().toISOString().slice(0, 10)}`, headers);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    )}
                  </div>

                  <ClaimRequestTable
                    requests={filtered}
                    isLoading={approval.isLoading}
                    role="hr"
                    enableBatch={tab === 'pending'}
                    onApprove={async (ids, remarks) => approval.approveClaim({ requestIds: ids, remarks })}
                    onReject={async (ids, remarks) => approval.rejectClaim({ requestIds: ids, remarks })}
                    isApproving={approval.isApproving}
                    isRejecting={approval.isRejecting}
                    showActions
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          <TabsContent value="types" className="mt-6">
            <ClaimTypeSetup />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
