/**
 * Timezone utilities to enforce Asia/Singapore (SGT) timezone in the frontend.
 */

export function getSingaporeDateString(date: Date = new Date()): string {
  // Returns "YYYY-MM-DD" in Asia/Singapore
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatToSingaporeDate(
  dateInput: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    ...options
  }).format(date);
}

export function formatToSingaporeTime(
  dateInput: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true }
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    ...options
  }).format(date);
}

export function formatToSingaporeDateTime(dateInput: Date | string | number): string {
  if (!dateInput) return "";
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  const dateStr = formatToSingaporeDate(date, { day: 'numeric', month: 'short' });
  const timeStr = formatToSingaporeTime(date, { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} • ${timeStr}`;
}
