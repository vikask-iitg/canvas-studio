const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "2 minutes ago", "yesterday", "just now". */
export function timeAgo(iso: string | number | Date, now = Date.now()) {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(secs) < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return rtf.format(Math.round(secs / 60), 'minute');
}
