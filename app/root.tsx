import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { useNonce } from "~/lib/nonce";
import { useState } from "react";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/Lafrentz - sygnet RGB.svg", type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Salki — Lafrentz</title>
        <Meta />
        <Links />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let message = "Coś poszło nie tak.";

  if (import.meta.env.DEV) {
    if (isRouteErrorResponse(error)) {
      status = error.status;
      message = JSON.stringify({ status: error.status, statusText: error.statusText, data: error.data });
    } else if (error instanceof Error) {
      message = error.message + '\n' + error.stack;
    } else {
      message = JSON.stringify(error);
    }
  } else if (isRouteErrorResponse(error)) {
    status = error.status; // status code alone isn't sensitive
  }

  // Plain-text report the user can paste to support. Built client-side only
  // when the button is clicked, so nothing extra is rendered on the server.
  function buildReport() {
    const lines = [
      `Błąd ${status}`,
      `Czas: ${new Date().toISOString()}`,
      `Adres: ${window.location.href}`,
      `Przeglądarka: ${navigator.userAgent}`,
    ];
    if (isRouteErrorResponse(error)) {
      lines.push(`Odpowiedź: ${error.status} ${error.statusText}`);
      if (typeof error.data === 'string' && error.data) lines.push(`Dane: ${error.data}`);
    } else if (error instanceof Error) {
      lines.push(`Komunikat: ${error.message}`);
      if (import.meta.env.DEV && error.stack) lines.push(error.stack);
    }
    return lines.join('\n');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-300 mb-4">{status}</p>
        <p className="text-gray-600">{message}</p>
        <CopyErrorButton getText={buildReport} />
        <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">← Strona główna</a>
      </div>
    </main>
  );
}

function CopyErrorButton({ getText }: { getText: () => string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (insecure context / denied) — legacy fallback.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy failed');
      } catch {
        setState('failed');
        return;
      }
    }
    setState('copied');
    setTimeout(() => setState('idle'), 3000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-5 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
    >
      {state === 'copied' ? 'Skopiowano ✓' : state === 'failed' ? 'Nie udało się skopiować' : 'Skopiuj informacje o błędzie'}
    </button>
  );
}
