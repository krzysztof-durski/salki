interface Attachment {
  filename: string;
  content: string;
  contentType: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
}

export async function sendEmail(env: CloudflareEnv, opts: EmailOptions): Promise<{ sent: boolean; error?: string }> {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const host = env.SMTP_HOST;
  const port = parseInt(env.SMTP_PORT ?? '587', 10);
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM;

  if (!host || !user || !pass) {
    console.warn('[email] SMTP not configured — skipping send', { to: recipients, subject: opts.subject });
    return { sent: false, error: `SMTP not configured (host=${host ?? 'missing'}, user=${user ? 'set' : 'missing'}, pass=${pass ? 'set' : 'missing'})` };
  }

  let lastError: string | undefined;
  let allSent = true;

  for (const recipient of recipients) {
    try {
      await sendSmtp({ host, port, user, pass, from, to: recipient, subject: opts.subject, html: opts.html, attachments: opts.attachments });
    } catch (err) {
      lastError = String(err);
      console.error('[email] Failed to send to', recipient, err);
      allSent = false;
    }
  }

  return { sent: allSent, error: lastError };
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/(.{76})/g, '$1\r\n').trim();
}

// Uses node:net + node:tls — works in both Node.js (local dev) and Cloudflare Workers (nodejs_compat).
async function sendSmtp(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<void> {
  const { host, port, user, pass, from, to, subject, html, attachments } = opts;
  const useStarttls = port === 587 || port === 25;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createConnection } = await import('node:net') as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { connect: tlsConnect } = await import('node:tls') as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let socket: any = createConnection({ host, port });
  await new Promise<void>((res, rej) => {
    socket.once('connect', res);
    socket.once('error', rej);
  });

  // Line buffering: parse \r\n-delimited SMTP responses
  let buf = '';
  const queue: string[] = [];
  let waiting: ((l: string) => void) | null = null;

  function onData(d: Buffer | Uint8Array) {
    buf += typeof d === 'string' ? d : new TextDecoder().decode(d);
    const parts = buf.split('\r\n');
    buf = parts.pop() ?? '';
    for (const line of parts) {
      if (waiting) {
        const fn = waiting;
        waiting = null;
        fn(line);
      } else {
        queue.push(line);
      }
    }
  }

  socket.on('data', onData);

  function readLine(): Promise<string> {
    if (queue.length) return Promise.resolve(queue.shift()!);
    return new Promise(r => { waiting = r; });
  }

  // Read full multi-line SMTP response (e.g. 250-xxx\r\n250 OK\r\n)
  async function readResponse(): Promise<string> {
    let last = '';
    while (true) {
      last = await readLine();
      if (last.length < 4 || last[3] !== '-') break;
    }
    return last;
  }

  function writeLine(line: string): Promise<void> {
    return new Promise((res, rej) => {
      socket.write(line + '\r\n', (e: Error | null | undefined) => (e ? rej(e) : res()));
    });
  }

  await readResponse(); // 220 greeting
  await writeLine('EHLO salki');
  await readResponse(); // 250 capabilities

  if (useStarttls) {
    await writeLine('STARTTLS');
    await readResponse(); // 220 go ahead

    socket.removeListener('data', onData);
    const plain = socket;
    socket = tlsConnect({ socket: plain, host, servername: host, rejectUnauthorized: false });
    await new Promise<void>((res, rej) => {
      socket.once('secureConnect', res);
      socket.once('error', rej);
    });

    buf = '';
    queue.length = 0;
    socket.on('data', onData);

    await writeLine('EHLO salki');
    await readResponse();
  }

  await writeLine('AUTH LOGIN');
  await readResponse(); // 334
  await writeLine(btoa(user));
  await readResponse(); // 334
  await writeLine(btoa(pass));
  const authResp = await readResponse(); // 235 or error
  if (!authResp.startsWith('2')) throw new Error(`SMTP AUTH failed: ${authResp}`);

  await writeLine(`MAIL FROM:<${from}>`);
  await readResponse();
  await writeLine(`RCPT TO:<${to}>`);
  await readResponse();
  await writeLine('DATA');
  await readResponse(); // 354

  const boundary = `b_${Date.now()}`;
  const hasAttachments = attachments && attachments.length > 0;
  const lines: string[] = [
    `From: Rezerwacje Lafrentz <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    html,
    '',
  ];
  if (hasAttachments) {
    for (const att of attachments!) {
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType}`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        '',
        toBase64(att.content),
        '',
      );
    }
  }
  lines.push(`--${boundary}--`);
  const body = lines.join('\r\n');

  await writeLine(body);
  await writeLine('.');
  await readResponse(); // 250 queued

  await writeLine('QUIT');
  socket.destroy();
}

// ─── Email templates ────────────────────────────────────────────────────────

export function tplNewRequest(params: {
  requesterName: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
  bookingId: number;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Nowa rezerwacja — ${params.roomName} (${params.date})`,
    html: `<p>Użytkownik <strong>${params.requesterName}</strong> złożył wniosek o rezerwację:</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.note ? `<li><strong>Uwagi:</strong> ${params.note}</li>` : ''}
</ul>
<p><a href="${params.appUrl}/admin/rezerwacje/${params.bookingId}">Przejdź do wniosku →</a></p>`,
  };
}

export function tplApproved(params: {
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  adminNote: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Rezerwacja zatwierdzona — ${params.roomName} (${params.date})`,
    html: `<p>Twoja rezerwacja została <strong>zatwierdzona</strong>.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ''}
</ul>`,
  };
}

export function tplRejected(params: {
  roomName: string;
  date: string;
  adminNote: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Rezerwacja odrzucona — ${params.roomName} (${params.date})`,
    html: `<p>Twoja rezerwacja została <strong>odrzucona</strong>.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  ${params.adminNote ? `<li><strong>Powód:</strong> ${params.adminNote}</li>` : ''}
</ul>`,
  };
}

export function tplCounterProposed(params: {
  roomName: string;
  originalDate: string;
  counterDate: string;
  counterStart: string;
  counterEnd: string;
  adminNote: string | null;
  bookingId: number;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Kontrpropozycja terminu — ${params.roomName}`,
    html: `<p>Administrator zaproponował inny termin dla Twojej rezerwacji.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Nowy termin:</strong> ${params.counterDate}, ${params.counterStart}–${params.counterEnd}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ''}
</ul>
<p>
  <a href="${params.appUrl}/rezerwacje/${params.bookingId}">Zaakceptuj lub odrzuć propozycję →</a>
</p>`,
  };
}

export function tplChangeRequestSubmitted(params: {
  requesterName: string;
  roomName: string;
  bookingId: number;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Wniosek o zmianę rezerwacji — ${params.roomName}`,
    html: `<p><strong>${params.requesterName}</strong> złożył wniosek o zmianę zatwierdzonej rezerwacji sali <strong>${params.roomName}</strong>.</p>
<p><a href="${params.appUrl}/admin/rezerwacje/${params.bookingId}">Przejdź do wniosku →</a></p>`,
  };
}

export function tplBookingEdited(params: {
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  adminNote: string | null;
  bookingId: number;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Rezerwacja zaktualizowana — ${params.roomName} (${params.date})`,
    html: `<p>Twoja rezerwacja została <strong>zaktualizowana</strong> przez administratora.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ''}
</ul>
<p><a href="${params.appUrl}/rezerwacje/${params.bookingId}">Zobacz rezerwację →</a></p>`,
  };
}

export function tplAccountCreated(params: {
  name: string;
  tempPassword: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: 'Twoje konto w systemie rezerwacji Lafrentz',
    html: `<p>Cześć ${params.name},</p>
<p>Twoje konto w systemie rezerwacji sal zostało utworzone.</p>
<ul>
  <li><strong>Login:</strong> Twój adres e-mail</li>
  <li><strong>Hasło tymczasowe:</strong> <code>${params.tempPassword}</code></li>
</ul>
<p>Przy pierwszym logowaniu zostaniesz poproszony o zmianę hasła.</p>
<p><a href="${params.appUrl}/login">Zaloguj się →</a></p>`,
  };
}

export function tplDutyOff(params: {
  adminName: string;
}): { subject: string; html: string } {
  return {
    subject: `Dyżur wyłączony — ${params.adminName}`,
    html: `<p><strong>${params.adminName}</strong> wyłączył(a) dyżur.</p>
<p>Upewnij się, że ktoś inny przejmie obowiązki obsługi wniosków o rezerwację.</p>`,
  };
}

export function tplAttendeeInvite(params: {
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  organizer: string;
}): { subject: string; html: string } {
  return {
    subject: `Zaproszenie na spotkanie — ${params.roomName} (${params.date})`,
    html: `<p>Twój adres e-mail został dodany do spotkania.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  <li><strong>Organizator:</strong> ${params.organizer}</li>
</ul>
<p>W załączniku znajdziesz plik kalendarza — możesz go otworzyć, aby dodać spotkanie do swojego kalendarza.</p>`,
  };
}

export function generateICS(params: {
  uid: string;
  summary: string;
  location: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  description?: string;
}): string {
  const dt = (date: string, time: string) =>
    `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lafrentz//Rezerwacje Sal//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Warsaw:${dt(params.date, params.startTime)}`,
    `DTEND;TZID=Europe/Warsaw:${dt(params.date, params.endTime)}`,
    `SUMMARY:${params.summary}`,
    `LOCATION:${params.location}`,
  ];
  if (params.description) lines.push(`DESCRIPTION:${params.description}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
