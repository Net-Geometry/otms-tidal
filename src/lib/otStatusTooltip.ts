/**
 * Generate tooltip text for OT request status badges
 * Shows detailed information about what stage the request is in and who is awaiting action
 */
export function getStatusTooltip(request: any): string | null {
  const supervisor = request.supervisor;
  const respectiveSupervisor = request.respective_supervisor;

  switch (request.status) {
    case 'pending_verification':
      return supervisor
        ? `Awaiting verification from ${supervisor.full_name} (${supervisor.employee_id})`
        : `Awaiting verification`;

    case 'pending_respective_supervisor_confirmation':
      return respectiveSupervisor
        ? `Awaiting confirmation from ${respectiveSupervisor.full_name} (${respectiveSupervisor.employee_id})`
        : `Awaiting confirmation`;

    case 'pending_supervisor_verification':
      return supervisor
        ? `Awaiting verification from ${supervisor.full_name} (${supervisor.employee_id})`
        : `Awaiting verification`;

    case 'supervisor_verified':
      return supervisor
        ? `Verified by ${supervisor.full_name} (${supervisor.employee_id})`
        : `Verified`;

    case 'supervisor_confirmed':
      return supervisor
        ? `Confirmed by ${supervisor.full_name} (${supervisor.employee_id})`
        : `Confirmed`;

    case 'respective_supervisor_confirmed':
      return respectiveSupervisor
        ? `Confirmed by ${respectiveSupervisor.full_name} (${respectiveSupervisor.employee_id})`
        : `Confirmed`;

    case 'hr_certified':
      return `Certified by HR`;

    case 'management_approved':
      return `Approved by Management`;

    case 'rejected':
      return `Rejected`;

    default:
      return null;
  }
}
