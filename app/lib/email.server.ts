import type { AdminNotificationType } from '~/types';
import { queryOne } from './db.server';

interface BookingContext {
  id: number;
  title: string | null;
  date: string;
  start_time: string;
  end_time: string;
  requester_note: string | null;
  room_name: string;
  requester_name: string;
}

interface EmailRecipient {
  id: number;
  email: string;
  name: string;
}

// Mirrors TYPE_CONFIG in app/routes/powiadomienia.tsx so the email badge,
// subject and copy read consistently with the in-app notification bell.
const NOTIFICATION_CONFIG: Record<AdminNotificationType, { badgeLabel: string; intro: string; color: 'amber' | 'violet' | 'slate' }> = {
  booking_requested: { badgeLabel: 'Nowy wniosek o rezerwację',   intro: 'Złożono nowy wniosek o rezerwację sali.',            color: 'amber'  },
  change_requested:  { badgeLabel: 'Wniosek o zmianę rezerwacji', intro: 'Złożono wniosek o zmianę zatwierdzonej rezerwacji.', color: 'amber'  },
  zarzad_created:    { badgeLabel: 'Zarząd zarezerwował salę',    intro: 'Zarząd zarezerwował salę bezpośrednio.',             color: 'violet' },
  zarzad_edited:     { badgeLabel: 'Zarząd zmienił rezerwację',   intro: 'Zarząd zmienił swoją rezerwację.',                   color: 'violet' },
  note_changed:      { badgeLabel: 'Zmiana uwag do rezerwacji',   intro: 'Zmieniono uwagi do rezerwacji.',                     color: 'slate'  },
};

// Same hues as the amber/violet/slate badges on the notifications page.
const BADGE_COLORS: Record<'amber' | 'violet' | 'slate', { bg: string; border: string; text: string }> = {
  amber:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  violet: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  slate:  { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' },
};

// Lafrentz brand red — matches --color-blue-600 in app/app.css, which
// replaces Tailwind's blue palette site-wide (buttons, links, accents).
const BRAND_RED = '#ff0000';

// Mirrors DETAIL_LABELS in app/routes/powiadomienia.tsx.
const DETAIL_LABELS: Record<string, string> = {
  note: 'Uwagi', date: 'Data', hours: 'Godziny', title: 'Tytuł', attendees: 'Uczestnicy',
};

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw',
  });
}

function parseDetails(details: string | null): Record<string, { from: unknown; to: unknown }> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDiffLine(key: string, val: { from: unknown; to: unknown }): { label: string; from: string | null; to: string } {
  const label = DETAIL_LABELS[key] ?? key;
  const from = val.from !== null && val.from !== undefined ? String(val.from) : null;
  const to = val.to !== null && val.to !== undefined ? String(val.to) : '—';
  return { label, from, to };
}

function buildHtml(env: CloudflareEnv, booking: BookingContext, type: AdminNotificationType, details: string | null, link: string): string {
  const cfg = NOTIFICATION_CONFIG[type];
  const badge = BADGE_COLORS[cfg.color];
  const diff = parseDetails(details);
  // The diff already shows an old→new "Uwagi" line when the note itself is
  // what changed (note_changed / change_requested) — only show the current
  // value separately when it isn't already covered there, to avoid repeats.
  const showCurrentNote = booking.requester_note && !(diff && 'note' in diff);
  const logoUrl = `${env.APP_BASE_URL}/assets/${encodeURIComponent('Lafrentz - logo podstawowe RGB.png')}`;

  const infoRows: Array<[string, string]> = [
    ['Sala', booking.room_name],
    ['Data', formatDate(booking.date)],
    ['Godziny', `${booking.start_time}–${booking.end_time}`],
    ['Zgłaszający', booking.requester_name],
  ];
  if (booking.title) infoRows.push(['Tytuł', booking.title]);
  if (showCurrentNote) infoRows.push(['Uwagi', booking.requester_note!]);

  const infoHtml = infoRows.map(([label, value]) => `
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const diffHtml = diff ? `
    <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.03em;">Zmiany</p>
      ${Object.entries(diff).map(([key, val]) => {
        const { label, from, to } = formatDiffLine(key, val);
        return `<p style="margin:4px 0;font-size:13px;color:#374151;">
          <strong>${escapeHtml(label)}:</strong>
          ${from ? `<span style="color:#9ca3af;text-decoration:line-through;">${escapeHtml(from)}</span> → ` : ''}
          <span style="color:#111827;font-weight:500;">${escapeHtml(to)}</span>
        </p>`;
      }).join('')}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="pl">
  <body style="margin:0;padding:24px 16px;background-color:#f9fafb;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="padding-bottom:20px;text-align:center;">
          <img src="${escapeHtml(logoUrl)}" alt="Lafrentz" height="28" style="height:28px;width:auto;">
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
          <span style="display:inline-block;background:${badge.bg};color:${badge.text};border:1px solid ${badge.border};border-radius:9999px;padding:4px 14px;font-size:12px;font-weight:600;">
            ${escapeHtml(cfg.badgeLabel)}
          </span>
          <p style="margin:16px 0 18px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(cfg.intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${infoHtml}</table>
          ${diffHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr>
              <td style="border-radius:8px;background:${BRAND_RED};">
                <a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                  Zobacz rezerwację →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top:18px;text-align:center;color:#9ca3af;font-size:12px;">
          System rezerwacji sal Lafrentz
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function buildText(booking: BookingContext, type: AdminNotificationType, details: string | null, link: string): string {
  const cfg = NOTIFICATION_CONFIG[type];
  const diff = parseDetails(details);
  const showCurrentNote = booking.requester_note && !(diff && 'note' in diff);
  const diffLines = diff
    ? ['', 'Zmiany:', ...Object.entries(diff).map(([key, val]) => {
        const { label, from, to } = formatDiffLine(key, val);
        return `  ${label}: ${from ? `${from} → ` : ''}${to}`;
      })]
    : [];

  return [
    cfg.badgeLabel,
    cfg.intro,
    '',
    `Sala: ${booking.room_name}`,
    `Data: ${formatDate(booking.date)}`,
    `Godziny: ${booking.start_time}–${booking.end_time}`,
    `Zgłaszający: ${booking.requester_name}`,
    booking.title ? `Tytuł: ${booking.title}` : null,
    showCurrentNote ? `Uwagi: ${booking.requester_note}` : null,
    ...diffLines,
    '',
    link,
  ].filter((line): line is string => line !== null).join('\n');
}

// Sends one email per recipient via Resend's batch endpoint (one HTTP call,
// each recipient only sees their own address in `to`). Never throws — a
// Resend outage must not break the booking action that triggered it; the
// in-app "bell" notification (inserted separately in notify.server.ts)
// remains the reliable fallback channel.
export async function sendAdminNotificationEmails(
  env: CloudflareEnv,
  bookingId: number,
  type: AdminNotificationType,
  recipients: EmailRecipient[],
  details: string | null,
): Promise<void> {
  try {
    const booking = await queryOne<BookingContext>(
      env.DB,
      `SELECT b.id, b.title, b.date, b.start_time, b.end_time, b.requester_note, r.name AS room_name, u.name AS requester_name
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = b.requester_id
       WHERE b.id = ?`,
      [bookingId]
    );
    if (!booking) return;

    const link = `${env.APP_BASE_URL}/rezerwacje/${bookingId}`;
    const subject = `${NOTIFICATION_CONFIG[type].badgeLabel} — ${booking.room_name}, ${formatDate(booking.date)}`;
    const html = buildHtml(env, booking, type, details, link);
    const text = buildText(booking, type, details, link);

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        recipients.map(r => ({
          from: env.RESEND_FROM_EMAIL,
          to: r.email,
          subject,
          html,
          text,
        }))
      ),
    });

    if (!res.ok) {
      console.error('sendAdminNotificationEmails: Resend request failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('sendAdminNotificationEmails failed', err);
  }
}
