import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/Lafrentz - sygnet RGB.svg", type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
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
        <ScrollRestoration />
        <Scripts />
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

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.status === 404 ? "Nie znaleziono strony." : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
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
