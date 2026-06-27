# Graph Report - .  (2026-06-27)

## Corpus Check
- Corpus is ~26,209 words - fits in a single context window. You may not need a graph.

## Summary
- 654 nodes · 1131 edges · 36 communities (31 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.92)
- Token cost: 22,100 input · 6,050 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Route & Domain Types|Route & Domain Types]]
- [[_COMMUNITY_Login Route Types|Login Route Types]]
- [[_COMMUNITY_Dependencies & Build|Dependencies & Build]]
- [[_COMMUNITY_Admin Logs Route Types|Admin Logs Route Types]]
- [[_COMMUNITY_Admin Panel Route Types|Admin Panel Route Types]]
- [[_COMMUNITY_Admin Bookings Route Types|Admin Bookings Route Types]]
- [[_COMMUNITY_Admin Rooms Route Types|Admin Rooms Route Types]]
- [[_COMMUNITY_Admin Users Route Types|Admin Users Route Types]]
- [[_COMMUNITY_App Layout Route Types|App Layout Route Types]]
- [[_COMMUNITY_Dashboard Route Types|Dashboard Route Types]]
- [[_COMMUNITY_Logout Route Types|Logout Route Types]]
- [[_COMMUNITY_Reservation Detail Types|Reservation Detail Types]]
- [[_COMMUNITY_Booking Edit Route Types|Booking Edit Route Types]]
- [[_COMMUNITY_Booking Change Types|Booking Change Types]]
- [[_COMMUNITY_New Booking Route Types|New Booking Route Types]]
- [[_COMMUNITY_Root Route Types|Root Route Types]]
- [[_COMMUNITY_Settings Route Types|Settings Route Types]]
- [[_COMMUNITY_Cloudflare Pages Entry|Cloudflare Pages Entry]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Lafrentz Signet Brand|Lafrentz Signet Brand]]
- [[_COMMUNITY_Lafrentz Vertical Logo|Lafrentz Vertical Logo]]
- [[_COMMUNITY_Lafrentz Primary Logo|Lafrentz Primary Logo]]
- [[_COMMUNITY_Calendar View Component|Calendar View Component]]
- [[_COMMUNITY_Cloudflare Environment Types|Cloudflare Environment Types]]
- [[_COMMUNITY_Database Schema|Database Schema]]
- [[_COMMUNITY_Logout & Session Cleanup|Logout & Session Cleanup]]
- [[_COMMUNITY_Nested Route Types|Nested Route Types]]
- [[_COMMUNITY_Vite Dev Configuration|Vite Dev Configuration]]
- [[_COMMUNITY_Pages Function Handler|Pages Function Handler]]
- [[_COMMUNITY_React Router Config|React Router Config]]
- [[_COMMUNITY_Router Future Flags|Router Future Flags]]
- [[_COMMUNITY_Request Handler|Request Handler]]

## God Nodes (most connected - your core abstractions)
1. `getTokenFromRequest()` - 50 edges
2. `getSessionUser()` - 48 edges
3. `requireUser()` - 44 edges
4. `execute()` - 28 edges
5. `queryAll()` - 23 edges
6. `logAction()` - 20 edges
7. `sendEmail()` - 18 edges
8. `BookingDetail()` - 18 edges
9. `canManageBookings()` - 17 edges
10. `isAdmin()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Environment Variables Setup` --conceptually_related_to--> `loadDevVars() - .dev.vars Parser`  [INFERRED]
  README.md → vite.config.ts
- `Deployment Model (Cloudflare Pages + custom subdomain)` --references--> `Wrangler CLI (Cloudflare)`  [EXTRACTED]
  README.md → package.json
- `React Router Server Build Module` --conceptually_related_to--> `SSR Hydration Pattern`  [INFERRED]
  .react-router/types/+server-build.d.ts → app/entry.client.tsx
- `@react-router/cloudflare Dependency` --conceptually_related_to--> `Cloudflare Pages Function Handler`  [INFERRED]
  package.json → functions/[[path]].ts
- `CloudflareEnv Interface` --conceptually_related_to--> `@cloudflare/workers-types Integration`  [INFERRED]
  functions/[[path]].ts → tsconfig.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Admin Routes Group (panel, rezerwacje, sale, uzytkownicy, logi)** — types_admin_logi, types_admin_panel, types_admin_rezerwacje, types_admin_sale, types_admin_uzytkownicy [INFERRED 0.95]
- **Reservation Routes Group (nowa, id, edytuj, zmiana)** — types_rezerwacje_nowa, types_rezerwacje__id, types_rezerwacje__id_edytuj, types_rezerwacje__id_zmiana [INFERRED 0.95]
- **Routes Nested Under _app Layout** — types__app, types_dashboard, types_admin_logi, types_admin_panel, types_admin_rezerwacje, types_admin_sale, types_admin_uzytkownicy, types_rezerwacje_nowa, types_rezerwacje__id, types_rezerwacje__id_edytuj, types_rezerwacje__id_zmiana, types_ustawienia [INFERRED 0.95]
- **Auth Routes (login, logout) - Root-level, No App Layout** — types_login, types_logout [INFERRED 0.95]
- **Booking Lifecycle: Create, Approve/Reject/Counter, Edit, Change Request** — routes_rezerwacje_nowa_nowarezerwacja, routes_rezerwacje_id_bookingdetail, routes_rezerwacje_id_edytuj_edytujrezerwacje, routes_rezerwacje_id_zmiana_zmianareze, lib_audit_server_logaction, lib_email_server_sendemail [INFERRED 0.95]
- **Authentication and Session Management Pattern** — lib_auth_server_gettokenfromrequest, lib_auth_server_getsessionuser, lib_auth_server_requireuser, lib_auth_server_createsession, lib_auth_server_deletesession [INFERRED 0.95]
- **Role-Based Permission Gates for Admin Routes** — app_types_canmanagebookings, app_types_canmanageusers, app_types_canmanagerooms, app_types_canviewauditlogs, app_types_isadmin [INFERRED 0.95]
- **Core Database Schema Tables** — migrations_0001_initial_users_table, migrations_0001_initial_sessions_table, migrations_0001_initial_rooms_table, migrations_0001_initial_bookings_table, migrations_0001_initial_booking_change_requests_table, migrations_0001_initial_audit_logs_table [EXTRACTED 1.00]
- **Cloudflare Pages Build Stack** — vite_config_vite_setup, react_router_config_ssr_config, package_json_wrangler, package_json_react_router_cloudflare, functions_path_pages_function_handler [INFERRED 0.95]
- **Local Development Environment Configuration** — vite_config_vite_setup, vite_config_cloudflare_dev_proxy, vite_config_load_dev_vars, tsconfig_compiler_options, tsconfig_path_alias [INFERRED 0.85]

## Communities (36 total, 5 thin omitted)

### Community 0 - "Route & Domain Types"
Cohesion: 0.07
Nodes (96): Route Configuration, assignableRoles(), AuditLog, Booking, BookingChangeRequest, BookingStatus, canDirectBookBoardRoom(), canDirectBookGeneralRoom() (+88 more)

### Community 1 - "Login Route Types"
Cohesion: 0.07
Nodes (28): React Router Route Hierarchy, ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps (+20 more)

### Community 2 - "Dependencies & Build"
Cohesion: 0.07
Nodes (28): dependencies, isbot, lucide-react, react, react-dom, react-router, @react-router/cloudflare, devDependencies (+20 more)

### Community 3 - "Admin Logs Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 4 - "Admin Panel Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 5 - "Admin Bookings Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 6 - "Admin Rooms Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 7 - "Admin Users Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 8 - "App Layout Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 9 - "Dashboard Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 10 - "Logout Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 11 - "Reservation Detail Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 12 - "Booking Edit Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 13 - "Booking Change Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 14 - "New Booking Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 15 - "Root Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 16 - "Settings Route Types"
Cohesion: 0.08
Nodes (23): ActionArgs, Annotations, ClientActionArgs, ClientLoaderArgs, ClientMiddlewareFunction, ComponentProps, ErrorBoundaryProps, HeadersArgs (+15 more)

### Community 17 - "Cloudflare Pages Entry"
Cohesion: 0.12
Nodes (19): CloudflareEnv Interface, Cloudflare Pages Function Handler, Server Build (React Router), Deploy Script (build + wrangler pages deploy), lucide-react Icon Library, Salki Project (package.json), @react-router/cloudflare Dependency, Tailwind CSS (+11 more)

### Community 18 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+9 more)

### Community 19 - "Lafrentz Signet Brand"
Cohesion: 0.18
Nodes (17): Adobe Illustrator 28.1.0, Lafrentz Brand Identity, Lafrentz Brand, Red Color (#FF0000), RGB Color Mode, White Color, Diagonal Slash / Dynamic Cut, Motion / Speed Symbol (+9 more)

### Community 20 - "Lafrentz Vertical Logo"
Cohesion: 0.30
Nodes (12): Adobe Illustrator 28.1.0, Lafrentz Brand Identity, Lafrentz Brand, Lafrentz Brand Color Black, Lafrentz Brand Color Red, Layered Horizontal Path Elements, Lafrentz Logo Vertical Layout, Lafrentz Vertical Logo (RGB) (+4 more)

### Community 21 - "Lafrentz Primary Logo"
Cohesion: 0.35
Nodes (12): Adobe Illustrator 28.1.0, Lafrentz Brand, Lafrentz Brand Identity, Brand Color Black, Brand Color Red, Brand Color White, Interlocking Geometric Shapes, Lafrentz Primary RGB Logo (+4 more)

### Community 22 - "Calendar View Component"
Cohesion: 0.27
Nodes (9): BookingSlot(), BookingTooltip(), CalendarView(), DAYS_SHORT, formatWeekRange(), getSlotColor(), getSlotLabel(), getWeekDates() (+1 more)

### Community 23 - "Cloudflare Environment Types"
Cohesion: 0.22
Nodes (5): AppLoadContext, CloudflareEnv, Cloudflare Environment (D1, SMTP, Session), SSR Hydration Pattern, React Router Server Build Module

### Community 24 - "Database Schema"
Cohesion: 0.29
Nodes (10): Audit Logs Table, Booking Change Requests Table, Booking Status Model (pending|approved|rejected|counter_proposed), Bookings Table, User Role Model (super_admin|admin|zarzad|dyrektor|pracownik), Rooms Table, Sessions Table, Users Table (+2 more)

### Community 25 - "Logout & Session Cleanup"
Cohesion: 0.53
Nodes (4): clearSessionCookie(), deleteSession(), action(), Logout Route

### Community 27 - "Nested Route Types"
Cohesion: 0.50
Nodes (4): App Layout Route Types, Reservation Detail Route Types, Reservation Edit Route Types, Reservation Change Route Types

## Knowledge Gaps
- **427 isolated node(s):** `Future`, `Register`, `Pages`, `RouteFiles`, `RouteModules` (+422 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App Layout Route Types` connect `Nested Route Types` to `Admin Logs Route Types`, `Admin Panel Route Types`, `Admin Bookings Route Types`, `Admin Rooms Route Types`, `Admin Users Route Types`, `Dashboard Route Types`, `New Booking Route Types`, `Root Route Types`, `Settings Route Types`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `React Router Route Hierarchy` connect `Login Route Types` to `Logout Route Types`, `Admin Logs Route Types`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `getTokenFromRequest()` connect `Route & Domain Types` to `Logout & Session Cleanup`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `Future`, `Register`, `Pages` to the rest of the system?**
  _428 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Route & Domain Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0746556473829201 - nodes in this community are weakly interconnected._
- **Should `Login Route Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Dependencies & Build` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._