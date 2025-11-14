export const STATUS_COLORS = {
  pending_verification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  pending_supervisor_confirmation: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  supervisor_verified: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  supervisor_confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  hr_certified: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  management_approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  pending_hr_recertification: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
} as const;

export const STATUS_LABELS = {
  pending_verification: 'Pending Verification',
  pending_supervisor_confirmation: 'Pending Confirmation',
  supervisor_verified: 'Verified by Supervisor',
  supervisor_confirmed: 'Confirmed by Supervisor',
  hr_certified: 'Certified by HR',
  management_approved: 'Approved by Management',
  rejected: 'Rejected',
  pending_hr_recertification: 'Pending HR Recertification',
} as const;