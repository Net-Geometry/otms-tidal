import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { AlertTriangle, FolderKanban, PiggyBank, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProjectsTable } from '@/components/finance/ProjectsTable';
import { ProjectForm } from '@/components/finance/ProjectForm';
import { ProjectCostBreakdown } from '@/components/finance/ProjectCostBreakdown';
import { ProjectCostAllocationForm } from '@/components/finance/ProjectCostAllocationForm';
import { useProjects } from '@/hooks/finance/useProjects';
import { useProjectCosts } from '@/hooks/finance/useProjectCosts';
import { useProjectDashboard } from '@/hooks/finance/useProjectDashboard';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { formatCurrency } from '@/lib/otCalculations';

export default function ProjectCosting() {
  const [tab, setTab] = useState<'projects' | 'allocations'>('projects');
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [allocationFormOpen, setAllocationFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const projects = useProjects();
  const projectCosts = useProjectCosts();
  const dashboard = useProjectDashboard();
  const coa = useChartOfAccounts({ accountType: 'expense', activity: 'active' });

  useEffect(() => {
    if (selectedProjectId !== 'all') return;
    if (!projects.projects.length) return;
    setSelectedProjectId(projects.projects[0].id);
  }, [projects.projects, selectedProjectId]);

  const editingProject = useMemo(() => {
    if (!editingProjectId) return null;
    return projects.projects.find((row) => row.id === editingProjectId) || null;
  }, [editingProjectId, projects.projects]);

  const selectedProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return projects.projects.find((row) => row.id === selectedProjectId) || null;
  }, [selectedProjectId, projects.projects]);

  const allocations = useMemo(() => {
    if (selectedProjectId === 'all') return projectCosts.allocations;
    return projectCosts.allocations.filter((row) => row.project_id === selectedProjectId);
  }, [projectCosts.allocations, selectedProjectId]);

  const stats = dashboard.data?.stats;

  return (
    <AppLayout>
      <PageLayout title="Project Costing" description="Manage projects, track cost allocations, and monitor budget utilization.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Active Projects" value={stats?.activeProjects ?? 0} subtitle="Currently in progress" icon={FolderKanban} />
          <DashboardCard title="Total Budget" value={formatCurrency(stats?.totalBudget || 0)} subtitle="Across active projects" icon={PiggyBank} />
          <DashboardCard title="Total Spent" value={formatCurrency(stats?.totalSpent || 0)} subtitle="All allocations" icon={TrendingUp} />
          <DashboardCard title="Over Budget" value={stats?.overBudgetProjects ?? 0} subtitle="Projects above budget" icon={AlertTriangle} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Project Costs</CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard.data?.monthlyCosts?.length ? (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No monthly cost data.</div>
              ) : (
                <ChartContainer config={{ amount: { label: 'Amount', color: '#14b8a6' } }} className="h-[250px]">
                  <BarChart data={dashboard.data.monthlyCosts}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard.data?.monthlyCosts?.length ? (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No trend data.</div>
              ) : (
                <ChartContainer config={{ amount: { label: 'Amount', color: '#3b82f6' } }} className="h-[250px]">
                  <LineChart data={dashboard.data.monthlyCosts}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="amount" stroke="var(--color-amount)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'projects' | 'allocations')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="allocations">Cost Allocations</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4 pt-2">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingProjectId(null);
                  setProjectFormOpen(true);
                }}
              >
                Add Project
              </Button>
            </div>

            <ProjectsTable
              projects={projects.projects}
              isLoading={projects.isLoading}
              onEdit={(project) => {
                setEditingProjectId(project.id);
                setProjectFormOpen(true);
              }}
              onArchive={async (project) => {
                await projects.archiveProject(project.id);
              }}
            />
          </TabsContent>

          <TabsContent value="allocations" className="space-y-4 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_code} - {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => setAllocationFormOpen(true)}>Add Manual Allocation</Button>
              </div>
            </div>

            <ProjectCostBreakdown project={selectedProject} allocations={allocations} />
          </TabsContent>
        </Tabs>

        <ProjectForm
          open={projectFormOpen}
          onOpenChange={setProjectFormOpen}
          project={editingProject}
          onSave={projects.upsertProject}
          isSaving={projects.isSaving}
        />

        <ProjectCostAllocationForm
          open={allocationFormOpen}
          onOpenChange={setAllocationFormOpen}
          projects={projects.projects}
          accounts={coa.accounts}
          onSubmit={projectCosts.createManualAllocation}
          isSubmitting={projectCosts.isCreating}
        />
      </PageLayout>
    </AppLayout>
  );
}
