import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { OTStatus } from '@/types/otms';

interface StatusWithMetadataProps {
  status: OTStatus | string;
  label?: string;
  rejectionStage?: string | null;
  tooltip?: string | null;
  metadata?: {
    by?: string | null;
    role?: string | null;
    date?: string | null;
  } | null;
  variant?: 'default' | 'submitted' | 'approved' | 'rejected' | 'pending' | 'checked' | 'reviewed';
}

const VARIANT_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500 hover:bg-blue-600 text-white border-transparent',
  approved: 'bg-green-500 hover:bg-green-600 text-white border-transparent',
  rejected: 'bg-red-500 hover:bg-red-600 text-white border-transparent',
  pending: 'bg-amber-500 hover:bg-amber-600 text-white border-transparent',
  checked: 'bg-blue-500 hover:bg-blue-600 text-white border-transparent',
  reviewed: 'bg-cyan-500 hover:bg-cyan-600 text-white border-transparent',
};

export function StatusWithMetadata({
  status,
  label,
  rejectionStage,
  tooltip,
  metadata,
  variant = 'default',
}: StatusWithMetadataProps) {
  const getStatusLabel = () => {
    if (label) return label;
    if (status === 'rejected' && rejectionStage) {
      return 'Rejected';
    }
    return STATUS_LABELS[status as OTStatus] || status;
  };

  const getBadgeClass = () => {
    if (variant !== 'default' && VARIANT_COLORS[variant]) {
      return VARIANT_COLORS[variant];
    }
    return STATUS_COLORS[status as OTStatus] || 'bg-gray-100 text-gray-700';
  };

  const renderContent = () => (
    <div className="flex flex-col gap-0.5 items-center text-center">
      <Badge className={`${getBadgeClass()} w-fit px-3 py-1 text-xs font-semibold rounded-full`}>
        {getStatusLabel()}
      </Badge>
      {metadata?.by && (
        <span className="text-xs text-muted-foreground leading-tight">
          By: {metadata.by}
        </span>
      )}
      {metadata?.role && (
        <span className="text-xs text-muted-foreground leading-tight">
          ({metadata.role})
        </span>
      )}
      {metadata?.date && !metadata.by && (
        <span className="text-xs text-muted-foreground leading-tight">
          {metadata.date}
        </span>
      )}
    </div>
  );

  // If no tooltip, return content as-is
  if (!tooltip) {
    return renderContent();
  }

  // Wrap with tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex flex-col gap-0.5 cursor-help items-center text-center">
          <Badge className={`${getBadgeClass()} w-fit px-3 py-1 text-xs font-semibold rounded-full`}>
            {getStatusLabel()}
          </Badge>
          {metadata?.by && (
            <span className="text-xs text-muted-foreground leading-tight">
              By: {metadata.by}
            </span>
          )}
          {metadata?.role && (
            <span className="text-xs text-muted-foreground leading-tight">
              ({metadata.role})
            </span>
          )}
          {metadata?.date && !metadata.by && (
            <span className="text-xs text-muted-foreground leading-tight">
              {metadata.date}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// Helper function to format approver metadata for OT requests
export function getOTApproverMetadata(request: any): { by: string | null; role: string | null } {
  if (!request) return { by: null, role: null };

  const status = request.status;

  // Map status to approver info
  switch (status) {
    case 'supervisor_confirmed':
    case 'supervisor_verified':
      return {
        by: request.supervisor?.full_name || null,
        role: 'Supervisor',
      };
    case 'respective_supervisor_confirmed':
      return {
        by: request.respective_supervisor?.full_name || null,
        role: 'Respective Supervisor',
      };
    case 'hr_certified':
      return {
        by: 'HR',
        role: 'HR Department',
      };
    case 'management_approved':
      return {
        by: 'Management',
        role: 'Management',
      };
    case 'rejected':
      if (request.rejection_stage === 'supervisor') {
        return {
          by: request.supervisor?.full_name || null,
          role: 'Supervisor',
        };
      } else if (request.rejection_stage === 'respective_supervisor') {
        return {
          by: request.respective_supervisor?.full_name || null,
          role: 'Respective Supervisor',
        };
      } else if (request.rejection_stage === 'hr') {
        return {
          by: 'HR',
          role: 'HR Department',
        };
      } else if (request.rejection_stage === 'management') {
        return {
          by: 'Management',
          role: 'Management',
        };
      }
      return { by: null, role: null };
    default:
      return { by: null, role: null };
  }
}

// Helper function to format approver metadata for Leave requests
export function getLeaveApproverMetadata(request: any): { by: string | null; role: string | null } {
  if (!request) return { by: null, role: null };

  const status = request.status;

  switch (status) {
    case 'supervisor_approved':
      return {
        by: request.supervisor_profile?.full_name || null,
        role: 'Supervisor',
      };
    case 'hr_approved':
      return {
        by: request.hr_profile?.full_name || 'HR',
        role: 'HR',
      };
    case 'management_approved':
      return {
        by: request.management_profile?.full_name || 'Management',
        role: 'Management',
      };
    case 'rejected':
      if (request.rejection_stage === 'supervisor') {
        return {
          by: request.supervisor_profile?.full_name || null,
          role: 'Supervisor',
        };
      } else if (request.rejection_stage === 'hr') {
        return {
          by: request.hr_profile?.full_name || 'HR',
          role: 'HR',
        };
      } else if (request.rejection_stage === 'management') {
        return {
          by: request.management_profile?.full_name || 'Management',
          role: 'Management',
        };
      }
      return { by: null, role: null };
    default:
      return { by: null, role: null };
  }
}

// Helper function to format approver metadata for Petty Cash transactions
export function getPettyCashApproverMetadata(txn: any): { by: string | null; role: string | null } {
  if (!txn) return { by: null, role: null };

  const status = txn.status;

  switch (status) {
    case 'approved':
      return {
        by: txn.approver?.full_name || null,
        role: 'Finance',
      };
    case 'rejected':
      return {
        by: txn.rejector?.full_name || null,
        role: 'Finance',
      };
    default:
      return { by: null, role: null };
  }
}

// Helper function to format approver metadata for Claim requests
export function getClaimApproverMetadata(request: any): { by: string | null; role: string | null } {
  if (!request) return { by: null, role: null };

  const status = request.status;

  switch (status) {
    case 'supervisor_approved':
      return {
        by: request.supervisor_profile?.full_name || null,
        role: 'Supervisor',
      };
    case 'hr_approved':
      return {
        by: request.hr_profile?.full_name || 'HR',
        role: 'HR',
      };
    case 'finance_approved':
      return {
        by: request.finance_profile?.full_name || 'Finance',
        role: 'Finance',
      };
    case 'director_approved':
      return {
        by: request.director_profile?.full_name || 'Director',
        role: 'Director',
      };
    case 'gm_approved':
      return {
        by: request.gm_profile?.full_name || 'GM',
        role: 'General Manager',
      };
    case 'head_finance_approved':
      return {
        by: request.head_finance_profile?.full_name || 'Head of Finance',
        role: 'Head of Finance',
      };
    case 'rejected':
      if (request.rejection_stage === 'supervisor') {
        return {
          by: request.supervisor_profile?.full_name || null,
          role: 'Supervisor',
        };
      } else if (request.rejection_stage === 'hr') {
        return {
          by: request.hr_profile?.full_name || 'HR',
          role: 'HR',
        };
      } else if (request.rejection_stage === 'finance') {
        return {
          by: request.finance_profile?.full_name || 'Finance',
          role: 'Finance',
        };
      } else if (request.rejection_stage === 'director') {
        return {
          by: request.director_profile?.full_name || 'Director',
          role: 'Director',
        };
      } else if (request.rejection_stage === 'gm') {
        return {
          by: request.gm_profile?.full_name || 'GM',
          role: 'General Manager',
        };
      } else if (request.rejection_stage === 'head_finance') {
        return {
          by: request.head_finance_profile?.full_name || 'Head of Finance',
          role: 'Head of Finance',
        };
      }
      return { by: null, role: null };
    default:
      return { by: null, role: null };
  }
}
