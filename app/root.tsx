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

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-300 mb-4">{status}</p>
        <p className="text-gray-600">{message}</p>
        <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">← Strona główna</a>
      </div>
    </main>
  );
}
