export const STATUS_COLORS = {
  pending_verification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  supervisor_verified: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  supervisor_confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  pending_respective_supervisor_confirmation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  respective_supervisor_confirmed: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
  pending_supervisor_verification: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  hr_certified: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  management_approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
} as const;

export const STATUS_LABELS = {
  pending_verification: 'Awaiting Verification',
  supervisor_verified: 'Verified',
  supervisor_confirmed: 'Confirmed',
  pending_respective_supervisor_confirmation: 'Awaiting Confirmation',
  respective_supervisor_confirmed: 'Confirmed',
  pending_supervisor_verification: 'Awaiting Verification',
  hr_certified: 'Certified',
  management_approved: 'Approved',
  rejected: 'Rejected',
} as const;