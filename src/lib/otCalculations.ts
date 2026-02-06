export function calculateTotalHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60; // Handle overnight shift
  }
  
  return Math.round((diffMinutes / 60) * 10) / 10;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return 'RM 0.00';
  return `RM ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '0.0';
  return hours.toFixed(1);
}

export function getDayTypeColor(dayType: string): string {
  const colors: Record<string, string> = {
    weekday: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    saturday: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    sunday: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    public_holiday: 'bg-red-500/10 text-red-700 dark:text-red-300',
    state_holiday: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  };
  return colors[dayType] || colors.weekday;
}

export function getDayTypeLabel(dayType: string): string {
  const labels: Record<string, string> = {
    weekday: 'Weekday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    public_holiday: 'Public Holiday',
    state_holiday: 'State Holiday',
  };
  return labels[dayType] || dayType;
}

export function getDayTypeCode(dayType: string): string {
  const normalized = (dayType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  const codes: Record<string, string> = {
    weekday: 'W',
    saturday: 'Sat',
    sunday: 'Sun',
    public_holiday: 'PH',
    state_holiday: 'PH',
  };

  return codes[normalized] || 'W';
}

export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
}
