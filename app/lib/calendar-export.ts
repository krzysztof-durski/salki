export interface CalendarExportEvent {
  id: number;
  title: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string | null;
  description?: string | null;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

export function buildIcsContent(event: CalendarExportEvent): string {
  const title = event.title ?? 'Rezerwacja sali';
  const dtStart = toIcsDateTime(event.date, event.startTime);
  const dtEnd = toIcsDateTime(event.date, event.endTime);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salki//Rezerwacje//PL',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(title)}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    `UID:booking-${event.id}@salki`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

export function downloadIcs(event: CalendarExportEvent): void {
  const blob = new Blob([buildIcsContent(event)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rezerwacja-${event.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(event: CalendarExportEvent): string {
  const title = event.title ?? 'Rezerwacja sali';
  const dtStart = toIcsDateTime(event.date, event.startTime);
  const dtEnd = toIcsDateTime(event.date, event.endTime);

  const gcUrl = new URL('https://calendar.google.com/calendar/render');
  gcUrl.searchParams.set('action', 'TEMPLATE');
  gcUrl.searchParams.set('text', title);
  gcUrl.searchParams.set('dates', `${dtStart}/${dtEnd}`);
  if (event.location) gcUrl.searchParams.set('location', event.location);
  if (event.description) gcUrl.searchParams.set('details', event.description);
  return gcUrl.toString();
}
