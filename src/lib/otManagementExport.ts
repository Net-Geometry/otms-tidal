import { format } from 'date-fns';

import { STATUS_LABELS } from './constants';

type ExportSession = {
  start_time?: string | null;
  end_time?: string | null;
  total_hours?: number | null;
};

type ExportRequest = {
  ticket_number?: string | null;
  ot_date?: string | null;
  status?: string | null;
  total_hours?: number | null;
  ot_amount?: number | null;
  supervisor_verified_at?: string | null;
  supervisor_confirmation_at?: string | null;
  respective_supervisor_confirmed_at?: string | null;
  hr_approved_at?: string | null;
  management_reviewed_at?: string | null;
  rejection_stage?: string | null;
  supervisor_remarks?: string | null;
  hr_remarks?: string | null;
  management_remarks?: string | null;
  sessions?: ExportSession[];
  profiles?: {
    employee_id?: string | null;
    full_name?: string | null;
    departments?: { name?: string | null } | null;
    companies?: { name?: string | null; code?: string | null } | null;
  } | null;
};

export type OTManagementExportRow = {
  ticket_number: string;
  employee_no: string;
  employee_name: string;
  company: string;
  department: string;
  ot_date: string;
  sessions: string;
  total_hours: number;
  ot_amount: number;
  current_status: string;
  included_in_claim: 'Yes' | 'No';
  claim_amount: number;
  supervisor_date: string;
  respective_supervisor_date: string;
  hr_certified_date: string;
  management_approved_date: string;
  rejection_stage: string;
  remarks: string;
};

export function getOTManagementStatusLabel(status?: string | null): string {
  if (!status) return 'N/A';
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
}

export function buildOTManagementExportRows(requests: ExportRequest[]): OTManagementExportRow[] {
  return requests.map((request) => {
    const isApproved = request.status === 'management_approved';
    const profile = request.profiles;
    const company = profile?.companies;

    return {
      ticket_number: request.ticket_number || '',
      employee_no: profile?.employee_id || '',
      employee_name: profile?.full_name || '',
      company: company?.name ? `${company.name}${company.code ? ` (${company.code})` : ''}` : '',
      department: profile?.departments?.name || '',
      ot_date: formatDate(request.ot_date),
      sessions: formatSessions(request.sessions || []),
      total_hours: Number(request.total_hours || 0),
      ot_amount: Number(request.ot_amount || 0),
      current_status: getOTManagementStatusLabel(request.status),
      included_in_claim: isApproved ? 'Yes' : 'No',
      claim_amount: isApproved ? Number(request.ot_amount || 0) : 0,
      supervisor_date: formatDateTime(request.supervisor_verified_at || request.supervisor_confirmation_at),
      respective_supervisor_date: formatDateTime(request.respective_supervisor_confirmed_at),
      hr_certified_date: formatDateTime(request.hr_approved_at),
      management_approved_date: formatDateTime(request.management_reviewed_at),
      rejection_stage: request.rejection_stage || '',
      remarks: [request.supervisor_remarks, request.hr_remarks, request.management_remarks]
        .filter(Boolean)
        .join(' | '),
    };
  });
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  return format(new Date(value), 'dd MMM yyyy');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  return format(new Date(value), 'dd MMM yyyy HH:mm');
}

function formatSessions(sessions: ExportSession[]): string {
  return sessions
    .map((session) => {
      const timeRange = [session.start_time, session.end_time].filter(Boolean).join(' - ');
      const hours = Number(session.total_hours || 0).toFixed(2);
      return timeRange ? `${timeRange} (${hours} hrs)` : `${hours} hrs`;
    })
    .join('; ');
}
