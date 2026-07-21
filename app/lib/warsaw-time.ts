// Bookings are for physical rooms in Poland, so "now" must always be Warsaw
// wall-clock time regardless of the viewer's browser or server runtime
// timezone (e.g. a Cloudflare Worker's clock is UTC) — otherwise now-lines,
// today-highlights, and default-selected dates drift by the local UTC offset.
export function getWarsawParts(): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

export function getWarsawNowMinutes(): number {
  const { hour, minute } = getWarsawParts();
  return Number(hour) * 60 + Number(minute);
}

export function getWarsawToday(): string {
  const { year, month, day } = getWarsawParts();
  return `${year}-${month}-${day}`;
}
