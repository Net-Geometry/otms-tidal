import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProjectBudgetBar } from '@/components/finance/ProjectBudgetBar';
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from '@/types/finance';

function statusVariant(status: ProjectStatus) {
  if (status === 'active') return 'default';
  if (status === 'completed') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

interface ProjectsTableProps {
  projects: Project[];
  isLoading?: boolean;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
}

export function ProjectsTable({ projects, isLoading, onEdit, onArchive }: ProjectsTableProps) {
  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading projects...</div>;
  }

  if (!projects.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No projects found.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Budget Utilization</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.project_code}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{project.project_name}</div>
                  {project.description && <div className="line-clamp-1 text-xs text-muted-foreground">{project.description}</div>}
                </div>
              </TableCell>
              <TableCell>{project.client_name || '-'}</TableCell>
              <TableCell>{project.companies?.name || '-'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(project.status) as any}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <ProjectBudgetBar budget={Number(project.budget_amount || 0)} spent={Number(project.total_spent || 0)} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(project)}>
                    Edit
                  </Button>
                  {project.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => onArchive(project)}>
                      Archive
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
