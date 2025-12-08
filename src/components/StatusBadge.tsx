import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { OTStatus } from '@/types/otms';

interface StatusBadgeProps {
  status: OTStatus;
  rejectionStage?: string | null;
  tooltip?: string | null;
}

export function StatusBadge({ status, rejectionStage, tooltip }: StatusBadgeProps) {
  const getStatusLabel = () => {
    if (status === 'rejected' && rejectionStage) {
      const roleMap: Record<string, string> = {
        'supervisor': 'Supervisor',
        'hr': 'HR',
        'management': 'Management',
        'respective_supervisor_verification': 'Respective Supervisor',
      };
      const roleName = roleMap[rejectionStage] || rejectionStage;
      return `Rejected`;
    }
    return STATUS_LABELS[status];
  };

  const badge = (
    <Badge className={STATUS_COLORS[status]}>
      {getStatusLabel()}
    </Badge>
  );

  // If no tooltip, return badge as-is
  if (!tooltip) {
    return badge;
  }

  // Wrap badge with tooltip (assuming TooltipProvider is at app level)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}