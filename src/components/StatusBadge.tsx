import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { OTStatus } from '@/types/otms';

interface StatusBadgeProps {
  status: OTStatus;
  rejectionStage?: string | null;
}

export function StatusBadge({ status, rejectionStage }: StatusBadgeProps) {
  const getStatusLabel = () => {
    if (status === 'rejected' && rejectionStage) {
      const roleMap: Record<string, string> = {
        'supervisor': 'Supervisor',
        'hr': 'HR',
        'management': 'Management',
      };
      const roleName = roleMap[rejectionStage] || rejectionStage;
      return `Rejected by ${roleName}`;
    }
    return STATUS_LABELS[status];
  };

  return (
    <Badge className={STATUS_COLORS[status]}>
      {getStatusLabel()}
    </Badge>
  );
}