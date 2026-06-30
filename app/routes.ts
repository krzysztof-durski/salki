import { type RouteConfig, index, layout, route, prefix } from "@react-router/dev/routes";

export default [
  // Auth (no shell)
  route("login",  "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),

  // API
  route("api/pending-count",  "routes/api.pending-count.ts"),
  route("api/notifications",  "routes/api.notifications.ts"),

  // Authenticated app shell
  layout("routes/_app.tsx", [
    index("routes/dashboard.tsx"),
    route("rezerwacje/nowa",               "routes/rezerwacje.nowa.tsx"),
    route("rezerwacje/:id",                "routes/rezerwacje.$id.tsx"),
    route("rezerwacje/:id/edytuj",         "routes/rezerwacje.$id.edytuj.tsx"),
    route("rezerwacje/:id/zmiana",         "routes/rezerwacje.$id.zmiana.tsx"),
    route("ustawienia",                    "routes/ustawienia.tsx"),
    route("powiadomienia",                 "routes/powiadomienia.tsx"),

    // Admin routes (admin + super_admin)
    ...prefix("admin", [
      route("dzisiaj",        "routes/admin.dzisiaj.tsx"),
      route("rezerwacje",     "routes/admin.rezerwacje.tsx"),
      route("panel",          "routes/admin.panel.tsx"),
      route("uzytkownicy",    "routes/admin.uzytkownicy.tsx"),
      route("sale",           "routes/admin.sale.tsx"),
      route("logi",           "routes/admin.logi.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
