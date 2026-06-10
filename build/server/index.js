import { Form, Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, UNSAFE_withErrorBoundaryProps, data, isRouteErrorResponse, redirect, useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Bell, CalendarDays, CalendarRange, CheckCircle, ChevronLeft, ChevronRight, ClipboardList, Clock, DoorOpen, Edit2, LogOut, Menu, Plus, RefreshCw, ScrollText, Settings, Star, ToggleLeft, ToggleRight, Trash2, Users, X, XCircle } from "lucide-react";
import { useRef, useState } from "react";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region app/entry.server.tsx
var entry_server_exports = /* @__PURE__ */ __exportAll({ default: () => handleRequest });
async function handleRequest(request, responseStatusCode, responseHeaders, routerContext) {
	const body = await renderToReadableStream(/* @__PURE__ */ jsx(ServerRouter, {
		context: routerContext,
		url: request.url
	}), {
		signal: request.signal,
		onError(error) {
			console.error(error);
			responseStatusCode = 500;
		}
	});
	if (isbot(request.headers.get("user-agent") ?? "")) await body.allReady;
	responseHeaders.set("Content-Type", "text/html");
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode
	});
}
//#endregion
//#region app/root.tsx
var root_exports = /* @__PURE__ */ __exportAll({
	ErrorBoundary: () => ErrorBoundary,
	Layout: () => Layout,
	default: () => root_default,
	links: () => links
});
var links = () => [{
	rel: "icon",
	href: "/assets/Lafrentz - sygnet RGB.svg",
	type: "image/svg+xml"
}];
function Layout({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "pl",
		children: [/* @__PURE__ */ jsxs("head", { children: [
			/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
			/* @__PURE__ */ jsx("meta", {
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			}),
			/* @__PURE__ */ jsx("title", { children: "Salki — Lafrentz" }),
			/* @__PURE__ */ jsx(Meta, {}),
			/* @__PURE__ */ jsx(Links, {})
		] }), /* @__PURE__ */ jsxs("body", {
			className: "bg-gray-50 text-gray-900 antialiased",
			children: [
				children,
				/* @__PURE__ */ jsx(ScrollRestoration, {}),
				/* @__PURE__ */ jsx(Scripts, {})
			]
		})]
	});
}
var root_default = UNSAFE_withComponentProps(function App() {
	return /* @__PURE__ */ jsx(Outlet, {});
});
var ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary({ error }) {
	let status = 500;
	let message = "Coś poszło nie tak.";
	if (isRouteErrorResponse(error)) {
		status = error.status;
		message = error.status === 404 ? "Nie znaleziono strony." : error.statusText || message;
	}
	return /* @__PURE__ */ jsx("main", {
		className: "min-h-screen flex items-center justify-center p-8",
		children: /* @__PURE__ */ jsxs("div", {
			className: "text-center",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-6xl font-bold text-gray-300 mb-4",
					children: status
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-gray-600",
					children: message
				}),
				/* @__PURE__ */ jsx("a", {
					href: "/",
					className: "mt-6 inline-block text-blue-600 hover:underline",
					children: "← Strona główna"
				})
			]
		})
	});
});
//#endregion
//#region app/lib/db.server.ts
async function queryAll(db, sql, params = []) {
	const stmt = db.prepare(sql);
	return (await (params.length ? stmt.bind(...params) : stmt).all()).results;
}
async function queryOne(db, sql, params = []) {
	const stmt = db.prepare(sql);
	return await (params.length ? stmt.bind(...params) : stmt).first() ?? null;
}
async function execute(db, sql, params = []) {
	const stmt = db.prepare(sql);
	return (params.length ? stmt.bind(...params) : stmt).run();
}
//#endregion
//#region app/lib/auth.server.ts
var SESSION_COOKIE = "session";
var SESSION_DURATION_HOURS = 24;
async function hashPassword(password) {
	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const bits = await crypto.subtle.deriveBits({
		name: "PBKDF2",
		hash: "SHA-256",
		salt,
		iterations: 1e5
	}, keyMaterial, 256);
	return `pbkdf2:${Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("")}:${Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function verifyPassword(password, stored) {
	const parts = stored.split(":");
	if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
	const saltBytes = Uint8Array.from(parts[1].match(/.{2}/g).map((h) => parseInt(h, 16)));
	const expectedHex = parts[2];
	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({
		name: "PBKDF2",
		hash: "SHA-256",
		salt: saltBytes,
		iterations: 1e5
	}, keyMaterial, 256);
	return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("") === expectedHex;
}
function generateToken(bytes = 32) {
	return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function createSession(db, userId) {
	const id = generateToken(32);
	await execute(db, "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
		id,
		userId,
		new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1e3).toISOString()
	]);
	return id;
}
async function getSessionUser(db, token) {
	if (!token) return null;
	return queryOne(db, `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1`, [token]);
}
async function deleteSession(db, token) {
	await execute(db, "DELETE FROM sessions WHERE id = ?", [token]);
}
function setSessionCookie(token) {
	return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_DURATION_HOURS * 3600}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
function clearSessionCookie() {
	return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
function getTokenFromRequest(request) {
	const cookie = request.headers.get("Cookie") ?? "";
	for (const part of cookie.split(";")) {
		const [k, v] = part.trim().split("=");
		if (k === SESSION_COOKIE) return v ?? "";
	}
	return "";
}
function requireUser(user) {
	if (!user) throw new Response(null, {
		status: 302,
		headers: { Location: "/login" }
	});
	return user;
}
//#endregion
//#region app/routes/login.tsx
var login_exports = /* @__PURE__ */ __exportAll({
	action: () => action$8,
	default: () => login_default,
	loader: () => loader$13
});
async function loader$13({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (await getSessionUser(env.DB, token)) return redirect("/");
	return null;
}
async function action$8({ request, context }) {
	const { env } = context.cloudflare;
	const form = await request.formData();
	const email = form.get("email")?.trim().toLowerCase();
	const password = form.get("password");
	if (!email || !password) return data({ error: "Wypełnij wszystkie pola." }, { status: 400 });
	const user = await queryOne(env.DB, "SELECT * FROM users WHERE email = ? AND is_active = 1", [email]);
	if (!user || !await verifyPassword(password, user.password_hash)) return data({ error: "Nieprawidłowy e-mail lub hasło." }, { status: 401 });
	const token = await createSession(env.DB, user.id);
	const headers = new Headers();
	headers.set("Set-Cookie", setSessionCookie(token));
	if (user.must_change_password) return redirect("/ustawienia?zmien-haslo=1", { headers });
	return redirect("/", { headers });
}
var login_default = UNSAFE_withComponentProps(function Login({ actionData }) {
	const pending = useNavigation().state === "submitting";
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "mb-8",
				children: /* @__PURE__ */ jsx("img", {
					src: "/assets/Lafrentz - logo podstawowe RGB.svg",
					alt: "Lafrentz",
					className: "h-12"
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-white shadow-sm border border-gray-200 rounded-xl w-full max-w-sm p-8",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-xl font-semibold text-gray-900 mb-6 text-center",
					children: "Logowanie"
				}), /* @__PURE__ */ jsxs(Form, {
					method: "post",
					className: "space-y-4",
					children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							htmlFor: "email",
							children: "Adres e-mail"
						}), /* @__PURE__ */ jsx("input", {
							id: "email",
							name: "email",
							type: "email",
							autoComplete: "email",
							required: true,
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							htmlFor: "password",
							children: "Hasło"
						}), /* @__PURE__ */ jsx("input", {
							id: "password",
							name: "password",
							type: "password",
							autoComplete: "current-password",
							required: true,
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						})] }),
						actionData?.error && /* @__PURE__ */ jsx("p", {
							className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
							children: actionData.error
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: pending,
							className: "w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors",
							children: pending ? "Logowanie…" : "Zaloguj się"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-6 text-xs text-gray-400",
				children: "System wewnętrzny — dostęp tylko dla pracowników Lafrentz"
			})
		]
	});
});
//#endregion
//#region app/routes/logout.tsx
var logout_exports = /* @__PURE__ */ __exportAll({
	action: () => action$7,
	loader: () => loader$12
});
async function action$7({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (token) await deleteSession(env.DB, token);
	return redirect("/login", { headers: { "Set-Cookie": clearSessionCookie() } });
}
async function loader$12() {
	return redirect("/login");
}
//#endregion
//#region app/types.ts
var ROLE_LABELS = {
	super_admin: "Super Admin",
	admin: "Administrator",
	zarzad: "Zarząd",
	dyrektor: "Dyrektor",
	pracownik: "Pracownik"
};
function canViewBoardRooms(role) {
	return role === "super_admin" || role === "admin" || role === "zarzad";
}
function canDirectBookBoardRoom(role) {
	return role === "super_admin" || role === "admin" || role === "zarzad";
}
function canDirectBookGeneralRoom(role) {
	return role === "super_admin" || role === "admin";
}
function canManageBookings(role) {
	return role === "super_admin" || role === "admin";
}
function canManageUsers(role) {
	return role === "super_admin" || role === "admin";
}
function canManageRooms(role) {
	return role === "super_admin";
}
function canViewAuditLogs(role) {
	return role === "super_admin";
}
function isAdmin(role) {
	return role === "super_admin" || role === "admin";
}
function assignableRoles(actorRole) {
	const all = [
		"admin",
		"zarzad",
		"dyrektor",
		"pracownik"
	];
	if (actorRole === "super_admin") return all;
	return all.filter((r) => r !== "zarzad");
}
//#endregion
//#region app/routes/_app.tsx
var _app_exports = /* @__PURE__ */ __exportAll({
	default: () => _app_default,
	loader: () => loader$11
});
async function loader$11({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	return { user: requireUser(await getSessionUser(env.DB, token)) };
}
var _app_default = UNSAFE_withComponentProps(function AppShell({ loaderData }) {
	const { user } = loaderData;
	useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);
	const nav = [
		{
			to: "/",
			label: "Kalendarz",
			icon: CalendarDays
		},
		...canManageBookings(user.role) ? [{
			to: "/admin/rezerwacje",
			label: "Wnioski",
			icon: ClipboardList
		}] : [],
		...canManageBookings(user.role) ? [{
			to: "/admin/panel",
			label: "Rezerwacje",
			icon: CalendarRange
		}] : [],
		...canManageUsers(user.role) ? [{
			to: "/admin/uzytkownicy",
			label: "Użytkownicy",
			icon: Users
		}] : [],
		...canManageRooms(user.role) ? [{
			to: "/admin/sale",
			label: "Sale",
			icon: DoorOpen
		}] : [],
		...canViewAuditLogs(user.role) ? [{
			to: "/admin/logi",
			label: "Logi",
			icon: ScrollText
		}] : [],
		{
			to: "/ustawienia",
			label: "Ustawienia",
			icon: Settings
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-screen overflow-hidden bg-gray-50",
		children: [
			/* @__PURE__ */ jsxs("aside", {
				className: "hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "flex items-center h-16 px-4 border-b border-gray-200",
						children: /* @__PURE__ */ jsx("img", {
							src: "/assets/Lafrentz - logo podstawowe RGB.svg",
							alt: "Lafrentz",
							className: "h-8"
						})
					}),
					/* @__PURE__ */ jsx("nav", {
						className: "flex-1 px-3 py-4 space-y-1 overflow-y-auto",
						children: nav.map(({ to, label, icon: Icon }) => /* @__PURE__ */ jsxs(NavLink, {
							to,
							end: to === "/",
							className: ({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`,
							children: [/* @__PURE__ */ jsx(Icon, { size: 18 }), label]
						}, to))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "border-t border-gray-200 px-3 py-4",
						children: [
							user.role === "admin" && /* @__PURE__ */ jsx(Form, {
								method: "post",
								action: "/logout",
								className: "w-full mb-2",
								children: /* @__PURE__ */ jsx(OnDutyToggle, { onDuty: !!user.on_duty })
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3 px-3 py-2 mb-1",
								children: [/* @__PURE__ */ jsx("div", {
									className: "w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold select-none",
									children: user.name.charAt(0).toUpperCase()
								}), /* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-medium text-gray-900 truncate",
										children: user.name
									}), /* @__PURE__ */ jsx("p", {
										className: "text-xs text-gray-500 truncate",
										children: user.email
									})]
								})]
							}),
							/* @__PURE__ */ jsx(Form, {
								method: "post",
								action: "/logout",
								children: /* @__PURE__ */ jsxs("button", {
									type: "submit",
									className: "flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors",
									children: [/* @__PURE__ */ jsx(LogOut, { size: 16 }), "Wyloguj się"]
								})
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200",
				children: [/* @__PURE__ */ jsx("img", {
					src: "/assets/Lafrentz - sygnet RGB.svg",
					alt: "Lafrentz",
					className: "h-8"
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => setMobileOpen((v) => !v),
					className: "p-2 rounded-lg text-gray-500 hover:bg-gray-100",
					children: mobileOpen ? /* @__PURE__ */ jsx(X, { size: 20 }) : /* @__PURE__ */ jsx(Menu, { size: 20 })
				})]
			}),
			mobileOpen && /* @__PURE__ */ jsx("div", {
				className: "md:hidden fixed inset-0 z-20 bg-black/40",
				onClick: () => setMobileOpen(false),
				children: /* @__PURE__ */ jsxs("aside", {
					className: "absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl pt-14 flex flex-col",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ jsx("nav", {
						className: "flex-1 px-3 py-4 space-y-1 overflow-y-auto",
						children: nav.map(({ to, label, icon: Icon }) => /* @__PURE__ */ jsxs(NavLink, {
							to,
							end: to === "/",
							onClick: () => setMobileOpen(false),
							className: ({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`,
							children: [/* @__PURE__ */ jsx(Icon, { size: 18 }), label]
						}, to))
					}), /* @__PURE__ */ jsx("div", {
						className: "border-t border-gray-200 px-3 py-4",
						children: /* @__PURE__ */ jsx(Form, {
							method: "post",
							action: "/logout",
							children: /* @__PURE__ */ jsxs("button", {
								type: "submit",
								className: "flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600",
								children: [/* @__PURE__ */ jsx(LogOut, { size: 16 }), "Wyloguj się"]
							})
						})
					})]
				})
			}),
			/* @__PURE__ */ jsx("main", {
				className: "flex-1 overflow-y-auto md:overflow-hidden flex flex-col mt-14 md:mt-0",
				children: /* @__PURE__ */ jsx(Outlet, {})
			})
		]
	});
});
function OnDutyToggle({ onDuty }) {
	return /* @__PURE__ */ jsxs(Form, {
		method: "post",
		action: "/ustawienia",
		children: [/* @__PURE__ */ jsx("input", {
			type: "hidden",
			name: "_action",
			value: "toggle_duty"
		}), /* @__PURE__ */ jsxs("button", {
			type: "submit",
			className: `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${onDuty ? "bg-green-50 text-green-700 hover:bg-green-100" : "text-gray-500 hover:bg-gray-100"}`,
			children: [/* @__PURE__ */ jsx(Bell, { size: 16 }), onDuty ? "Dyżur aktywny" : "Włącz dyżur"]
		})]
	});
}
//#endregion
//#region app/components/CalendarView.tsx
var START_HOUR = 7;
var END_HOUR = 21;
var SLOT_MINUTES = 30;
var TOTAL_SLOTS = (END_HOUR - START_HOUR) * 60 / SLOT_MINUTES;
var SLOT_HEIGHT = 48;
var DAYS_SHORT = [
	"Pon",
	"Wt",
	"Śr",
	"Czw",
	"Pt"
];
function CalendarView({ user, rooms, bookings, activeRoomId, weekStart }) {
	const navigate = useNavigate();
	const slotGridRefs = useRef([]);
	const [dragState, setDragState] = useState(null);
	const [hoverState, setHoverState] = useState(null);
	const [tooltip, setTooltip] = useState(null);
	const weekDates = getWeekDates(weekStart);
	const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];
	const roomBookings = bookings.filter((b) => b.room_id === activeRoomId);
	function goToWeek(offset) {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + offset * 7);
		navigate(`/?week=${d.toISOString().split("T")[0]}&sala=${activeRoomId}`);
	}
	function switchRoom(roomId) {
		navigate(`/?week=${weekStart}&sala=${roomId}`);
	}
	function openNewBooking(date, startTime, endTime) {
		navigate(`/rezerwacje/nowa?sala=${activeRoomId}&data=${date}&od=${startTime}&do=${endTime}`);
	}
	function slotFromClientY(slotGrid, clientY) {
		const y = clientY - slotGrid.getBoundingClientRect().top;
		return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
	}
	function handleMouseDown(dayIndex, e) {
		if (e.button !== 0) return;
		const slot = slotFromClientY(e.currentTarget, e.clientY);
		setHoverState(null);
		setDragState({
			dayIndex,
			startSlot: slot,
			endSlot: slot,
			active: true
		});
		e.preventDefault();
	}
	function handleOuterMouseMove(e) {
		if (!dragState?.active) return;
		const slotGrid = slotGridRefs.current[dragState.dayIndex];
		if (!slotGrid) return;
		const slot = slotFromClientY(slotGrid, e.clientY);
		setDragState((ds) => ds ? {
			...ds,
			endSlot: slot
		} : null);
	}
	function handleMouseUp(dayIndex) {
		if (!dragState?.active || dragState.dayIndex !== dayIndex) {
			setDragState(null);
			return;
		}
		const { startSlot, endSlot } = dragState;
		setDragState(null);
		const lo = Math.min(startSlot, endSlot);
		const hi = Math.max(startSlot, endSlot);
		openNewBooking(weekDates[dayIndex], slotToTime(lo), slotToTime(hi + 1));
	}
	function handleDayClick(dayIndex, e) {
		if (dragState) return;
		const slot = slotFromClientY(e.currentTarget, e.clientY);
		const date = weekDates[dayIndex];
		openNewBooking(date, slotToTime(slot), slotToTime(Math.min(slot + 2, TOTAL_SLOTS)));
	}
	function handleColumnMouseMove(dayIndex, e) {
		if (dragState?.active) return;
		setHoverState({
			dayIndex,
			slot: slotFromClientY(e.currentTarget, e.clientY)
		});
	}
	const isToday = (date) => date === todayString();
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col h-full overflow-hidden",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto shrink-0",
				children: rooms.map((room) => /* @__PURE__ */ jsxs("button", {
					onClick: () => switchRoom(room.id),
					className: `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${room.id === activeRoomId ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`,
					children: [
						room.name,
						room.id === user.preferred_room_id && /* @__PURE__ */ jsx(Star, {
							size: 12,
							className: "fill-yellow-400 text-yellow-400"
						}),
						room.category === "board" && /* @__PURE__ */ jsx("span", {
							className: "text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full",
							children: "Zarząd"
						})
					]
				}, room.id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("button", {
							onClick: () => goToWeek(-1),
							className: "p-1.5 rounded-lg hover:bg-gray-100 text-gray-500",
							children: /* @__PURE__ */ jsx(ChevronLeft, { size: 18 })
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-sm font-medium text-gray-700",
							children: formatWeekRange(weekStart)
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => goToWeek(1),
							className: "p-1.5 rounded-lg hover:bg-gray-100 text-gray-500",
							children: /* @__PURE__ */ jsx(ChevronRight, { size: 18 })
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => navigate(`/?sala=${activeRoomId}`),
							className: "ml-2 text-xs text-blue-600 hover:underline",
							children: "Dzisiaj"
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3",
					children: [activeRoom?.size_label && /* @__PURE__ */ jsx("span", {
						className: "text-xs text-gray-400",
						children: activeRoom.size_label
					}), /* @__PURE__ */ jsxs("button", {
						onClick: () => navigate(`/rezerwacje/nowa?sala=${activeRoomId}`),
						className: "flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors",
						children: [/* @__PURE__ */ jsx(Plus, { size: 15 }), "Utwórz rezerwację"]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-1 overflow-hidden",
				children: [/* @__PURE__ */ jsx("div", {
					className: "w-14 shrink-0 bg-white border-r border-gray-200 pt-8 overflow-hidden",
					children: Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
						const minutes = START_HOUR * 60 + i * SLOT_MINUTES;
						if (minutes % 60 !== 0) return /* @__PURE__ */ jsx("div", { style: { height: SLOT_HEIGHT } }, i);
						return /* @__PURE__ */ jsx("div", {
							style: { height: SLOT_HEIGHT },
							className: "relative flex items-start justify-end pr-2",
							children: /* @__PURE__ */ jsxs("span", {
								className: "text-xs text-gray-400 -mt-2",
								children: [String(minutes / 60).padStart(2, "0"), ":00"]
							})
						}, i);
					})
				}), /* @__PURE__ */ jsx("div", {
					className: "flex flex-1 overflow-y-auto overflow-x-hidden select-none",
					onMouseMove: handleOuterMouseMove,
					onMouseLeave: () => {
						setDragState(null);
						setHoverState(null);
					},
					children: weekDates.map((date, dayIndex) => {
						const dayBookings = roomBookings.filter((b) => b.date === date);
						const isDraggingHere = dragState?.active && dragState.dayIndex === dayIndex;
						const isHoveringHere = !dragState?.active && hoverState?.dayIndex === dayIndex;
						const hoverSlot = hoverState?.slot ?? 0;
						const hoverOccupied = isHoveringHere && dayBookings.some((b) => hoverSlot >= timeToSlot(b.start_time) && hoverSlot < timeToSlot(b.end_time));
						const showHoverPreview = isHoveringHere && !hoverOccupied;
						const previewEnd = Math.min(hoverSlot + 2, TOTAL_SLOTS);
						return /* @__PURE__ */ jsxs("div", {
							className: "flex-1 min-w-0 border-r border-gray-100 last:border-r-0 relative",
							children: [/* @__PURE__ */ jsxs("div", {
								className: `sticky top-0 z-10 text-center py-1 border-b border-gray-100 bg-white ${isToday(date) ? "bg-blue-50" : ""}`,
								children: [/* @__PURE__ */ jsx("p", {
									className: `text-xs font-medium ${isToday(date) ? "text-blue-700" : "text-gray-500"}`,
									children: DAYS_SHORT[dayIndex]
								}), /* @__PURE__ */ jsx("p", {
									className: `text-sm font-semibold ${isToday(date) ? "text-blue-700" : "text-gray-900"}`,
									children: (/* @__PURE__ */ new Date(date + "T12:00:00")).getDate()
								})]
							}), /* @__PURE__ */ jsxs("div", {
								ref: (el) => {
									slotGridRefs.current[dayIndex] = el;
								},
								className: "relative",
								style: { height: TOTAL_SLOTS * SLOT_HEIGHT },
								onMouseDown: (e) => handleMouseDown(dayIndex, e),
								onMouseUp: () => handleMouseUp(dayIndex),
								onMouseMove: (e) => handleColumnMouseMove(dayIndex, e),
								onMouseLeave: () => setHoverState(null),
								onClick: (e) => handleDayClick(dayIndex, e),
								children: [
									Array.from({ length: TOTAL_SLOTS }).map((_, i) => /* @__PURE__ */ jsx("div", {
										className: `absolute left-0 right-0 border-t ${i % 2 === 0 ? "border-gray-200" : "border-gray-100"}`,
										style: { top: i * SLOT_HEIGHT }
									}, i)),
									showHoverPreview && hoverState && /* @__PURE__ */ jsx("div", {
										className: "absolute left-1 right-1 pointer-events-none z-[5]",
										style: {
											top: hoverSlot * SLOT_HEIGHT,
											height: (previewEnd - hoverSlot) * SLOT_HEIGHT,
											transition: "top 60ms ease-out"
										},
										children: /* @__PURE__ */ jsxs("div", {
											className: "h-full rounded-md bg-blue-50 border-2 border-blue-300 border-dashed flex flex-col justify-between px-1.5 py-1 overflow-hidden",
											children: [/* @__PURE__ */ jsx("span", {
												className: "text-[11px] font-semibold text-blue-600 leading-none",
												children: slotToTime(hoverSlot)
											}), /* @__PURE__ */ jsx("span", {
												className: "text-[10px] text-blue-400 self-end leading-none",
												children: slotToTime(previewEnd)
											})]
										})
									}),
									isDraggingHere && dragState && /* @__PURE__ */ jsx("div", {
										className: "absolute left-1 right-1 pointer-events-none z-[5]",
										style: {
											top: Math.min(dragState.startSlot, dragState.endSlot) * SLOT_HEIGHT,
											height: (Math.abs(dragState.endSlot - dragState.startSlot) + 1) * SLOT_HEIGHT
										},
										children: /* @__PURE__ */ jsxs("div", {
											className: "h-full rounded-md bg-blue-200 border-2 border-blue-500 flex flex-col justify-between px-1.5 py-1 overflow-hidden",
											children: [/* @__PURE__ */ jsx("span", {
												className: "text-[11px] font-semibold text-blue-800 leading-none",
												children: slotToTime(Math.min(dragState.startSlot, dragState.endSlot))
											}), /* @__PURE__ */ jsx("span", {
												className: "text-[10px] text-blue-700 self-end leading-none",
												children: slotToTime(Math.min(Math.max(dragState.startSlot, dragState.endSlot) + 1, TOTAL_SLOTS))
											})]
										})
									}),
									dayBookings.map((booking) => /* @__PURE__ */ jsx(BookingSlot, {
										booking,
										userId: user.id,
										isAdminView: isAdmin(user.role),
										onTooltip: setTooltip
									}, booking.id))
								]
							})]
						}, date);
					})
				})]
			}),
			tooltip && /* @__PURE__ */ jsx(BookingTooltip, {
				booking: tooltip.booking,
				userId: user.id,
				onClose: () => setTooltip(null)
			})
		]
	});
}
function BookingSlot({ booking, userId, isAdminView, onTooltip }) {
	const navigate = useNavigate();
	const isOwn = booking.requester_id === userId;
	const top = timeToSlot(booking.start_time) * SLOT_HEIGHT;
	const height = Math.max(SLOT_HEIGHT, (timeToSlot(booking.end_time) - timeToSlot(booking.start_time)) * SLOT_HEIGHT);
	const colorClass = getSlotColor(booking.status, isOwn);
	const label = getSlotLabel(booking.status, isOwn);
	const isBooked = booking.status === "approved";
	function handleClick(e) {
		e.stopPropagation();
		if (isBooked && !isOwn && !isAdminView) {
			onTooltip({
				booking,
				x: e.clientX,
				y: e.clientY
			});
			return;
		}
		navigate(`/rezerwacje/${booking.id}`);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: `absolute left-0.5 right-0.5 rounded overflow-hidden text-xs px-1.5 py-1 z-10 ${colorClass} ${isBooked && !isOwn && !isAdminView ? "cursor-not-allowed" : "cursor-pointer hover:brightness-95"}`,
		style: {
			top,
			height
		},
		onClick: handleClick,
		title: isBooked && !isOwn ? booking.title ?? "Zarezerwowano" : void 0,
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "font-semibold leading-tight truncate",
				children: label
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "opacity-80 truncate",
				children: [
					booking.start_time,
					"–",
					booking.end_time
				]
			}),
			(isOwn || isAdminView) && booking.title && /* @__PURE__ */ jsx("p", {
				className: "opacity-70 truncate",
				children: booking.title
			})
		]
	});
}
function getSlotColor(status, isOwn) {
	if (status === "approved") return isOwn ? "bg-sky-200 text-sky-900" : "bg-blue-200 text-blue-800";
	if (status === "pending") return "bg-amber-200 text-amber-900";
	if (status === "counter_proposed") return "bg-orange-200 text-orange-900";
	return "bg-gray-200 text-gray-600";
}
function getSlotLabel(status, isOwn) {
	if (status === "approved") return isOwn ? "Moja rezerwacja" : "Zajęte";
	if (status === "pending") return "Oczekuje";
	if (status === "counter_proposed") return "Kontrpropozycja";
	return "Odrzucono";
}
function BookingTooltip({ booking, onClose }) {
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50",
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("div", {
			className: "absolute bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm w-52",
			style: {
				top: 100,
				left: "50%",
				transform: "translateX(-50%)"
			},
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "font-semibold text-gray-900",
					children: booking.title ?? "Zarezerwowano"
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "text-gray-500 text-xs mt-1",
					children: [
						booking.date,
						", ",
						booking.start_time,
						"–",
						booking.end_time
					]
				}),
				/* @__PURE__ */ jsx("button", {
					onClick: onClose,
					className: "mt-2 text-xs text-gray-400 hover:text-gray-600",
					children: "Zamknij"
				})
			]
		})
	});
}
function getWeekDates(weekStart) {
	const dates = [];
	const d = /* @__PURE__ */ new Date(weekStart + "T12:00:00");
	for (let i = 0; i < 5; i++) {
		dates.push(d.toISOString().split("T")[0]);
		d.setDate(d.getDate() + 1);
	}
	return dates;
}
function slotToTime(slot) {
	const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeToSlot(time) {
	const [h, m] = time.split(":").map(Number);
	return ((h - START_HOUR) * 60 + m) / SLOT_MINUTES;
}
function todayString() {
	return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function formatWeekRange(weekStart) {
	const start = /* @__PURE__ */ new Date(weekStart + "T12:00:00");
	const end = /* @__PURE__ */ new Date(weekStart + "T12:00:00");
	end.setDate(end.getDate() + 4);
	const opts = {
		day: "numeric",
		month: "long"
	};
	return `${start.toLocaleDateString("pl-PL", opts)} – ${end.toLocaleDateString("pl-PL", {
		...opts,
		year: "numeric"
	})}`;
}
//#endregion
//#region app/routes/dashboard.tsx
var dashboard_exports = /* @__PURE__ */ __exportAll({
	default: () => dashboard_default,
	loader: () => loader$10
});
async function loader$10({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const rooms = await queryAll(env.DB, `SELECT id, name, size_label, category, is_active, sort_order
     FROM rooms WHERE is_active = 1 ORDER BY sort_order ASC`);
	const visibleRooms = canViewBoardRooms(user.role) ? rooms : rooms.filter((r) => r.category === "general");
	const url = new URL(request.url);
	const weekParam = url.searchParams.get("week");
	const weekStart = weekParam ? new Date(weekParam) : getMonday(/* @__PURE__ */ new Date());
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekEnd.getDate() + 6);
	const dateFrom = toDateString(weekStart);
	const dateTo = toDateString(weekEnd);
	const roomIds = visibleRooms.map((r) => r.id);
	let bookings = [];
	if (roomIds.length > 0) {
		const placeholders = roomIds.map(() => "?").join(",");
		const statusFilter = isAdmin(user.role) ? `status IN ('pending','approved','counter_proposed')` : `(status = 'approved' OR (requester_id = ${user.id} AND status IN ('pending','counter_proposed')))`;
		bookings = await queryAll(env.DB, `SELECT b.*, r.name as room_name, u.name as requester_name
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = b.requester_id
       WHERE b.room_id IN (${placeholders})
         AND b.date BETWEEN ? AND ?
         AND ${statusFilter}
       ORDER BY b.date, b.start_time`, [
			...roomIds,
			dateFrom,
			dateTo
		]);
	}
	const activeRoomParam = url.searchParams.get("sala");
	let activeRoomId;
	if (activeRoomParam) activeRoomId = parseInt(activeRoomParam, 10);
	else if (user.preferred_room_id && visibleRooms.find((r) => r.id === user.preferred_room_id)) activeRoomId = user.preferred_room_id;
	else activeRoomId = visibleRooms[0]?.id ?? 0;
	return {
		user,
		rooms: visibleRooms,
		bookings,
		activeRoomId,
		weekStart: toDateString(weekStart)
	};
}
var dashboard_default = UNSAFE_withComponentProps(function Dashboard({ loaderData }) {
	const { user, rooms, bookings, activeRoomId, weekStart } = loaderData;
	return /* @__PURE__ */ jsx("div", {
		className: "flex flex-col h-full overflow-hidden",
		children: /* @__PURE__ */ jsx(CalendarView, {
			user,
			rooms,
			bookings,
			activeRoomId,
			weekStart
		})
	});
});
function getMonday(d) {
	const date = new Date(d);
	const day = date.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	date.setDate(date.getDate() + diff);
	date.setHours(0, 0, 0, 0);
	return date;
}
function toDateString(d) {
	return d.toISOString().split("T")[0];
}
//#endregion
//#region app/lib/audit.server.ts
async function logAction(db, opts) {
	await execute(db, `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`, [
		opts.userId,
		opts.action,
		opts.entityType,
		opts.entityId ?? null,
		opts.details ? JSON.stringify(opts.details) : null,
		opts.ipAddress ?? null
	]);
}
//#endregion
//#region app/lib/email.server.ts
async function sendEmail(env, opts) {
	const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
	const host = env.SMTP_HOST;
	const port = parseInt(env.SMTP_PORT ?? "587", 10);
	const user = env.SMTP_USER;
	const pass = env.SMTP_PASS;
	const from = env.SMTP_FROM;
	if (!host || !user || !pass) {
		console.warn("[email] SMTP not configured — skipping send", {
			to: recipients,
			subject: opts.subject
		});
		return;
	}
	const { connect } = await import("cloudflare:sockets");
	for (const recipient of recipients) try {
		await sendSmtp({
			connect,
			host,
			port,
			user,
			pass,
			from,
			to: recipient,
			subject: opts.subject,
			html: opts.html
		});
	} catch (err) {
		console.error("[email] Failed to send to", recipient, err);
	}
}
async function sendSmtp(opts) {
	const { connect, host, port, user, pass, from, to, subject, html } = opts;
	const useStarttls = port === 587 || port === 25;
	const socket = useStarttls ? connect({
		hostname: host,
		port
	}, { secureTransport: "starttls" }) : connect({
		hostname: host,
		port
	}, { secureTransport: "on" });
	const writer = socket.writable.getWriter();
	const reader = socket.readable.getReader();
	const enc = new TextEncoder();
	const dec = new TextDecoder();
	async function read() {
		const { value } = await reader.read();
		return dec.decode(value);
	}
	async function write(line) {
		await writer.write(enc.encode(line + "\r\n"));
	}
	await read();
	await write(`EHLO salki`);
	await read();
	if (useStarttls) {
		await write("STARTTLS");
		await read();
		socket.startTls();
		await write(`EHLO salki`);
		await read();
	}
	await write(`AUTH LOGIN`);
	await read();
	await write(btoa(user));
	await read();
	await write(btoa(pass));
	await read();
	await write(`MAIL FROM:<${from}>`);
	await read();
	await write(`RCPT TO:<${to}>`);
	await read();
	await write("DATA");
	await read();
	const boundary = `b_${Date.now()}`;
	await write([
		`From: Rezerwacje Lafrentz <${from}>`,
		`To: ${to}`,
		`Subject: ${subject}`,
		`MIME-Version: 1.0`,
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		`Content-Type: text/html; charset=UTF-8`,
		"",
		html,
		"",
		`--${boundary}--`,
		"",
		"."
	].join("\r\n"));
	await read();
	await write("QUIT");
	writer.releaseLock();
	reader.releaseLock();
	await socket.close();
}
function tplNewRequest(params) {
	return {
		subject: `Nowa rezerwacja — ${params.roomName} (${params.date})`,
		html: `<p>Użytkownik <strong>${params.requesterName}</strong> złożył wniosek o rezerwację:</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.note ? `<li><strong>Uwagi:</strong> ${params.note}</li>` : ""}
</ul>
<p><a href="${params.appUrl}/admin/rezerwacje/${params.bookingId}">Przejdź do wniosku →</a></p>`
	};
}
function tplApproved(params) {
	return {
		subject: `Rezerwacja zatwierdzona — ${params.roomName} (${params.date})`,
		html: `<p>Twoja rezerwacja została <strong>zatwierdzona</strong>.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ""}
</ul>`
	};
}
function tplRejected(params) {
	return {
		subject: `Rezerwacja odrzucona — ${params.roomName} (${params.date})`,
		html: `<p>Twoja rezerwacja została <strong>odrzucona</strong>.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  ${params.adminNote ? `<li><strong>Powód:</strong> ${params.adminNote}</li>` : ""}
</ul>`
	};
}
function tplCounterProposed(params) {
	return {
		subject: `Kontrpropozycja terminu — ${params.roomName}`,
		html: `<p>Administrator zaproponował inny termin dla Twojej rezerwacji.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Nowy termin:</strong> ${params.counterDate}, ${params.counterStart}–${params.counterEnd}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ""}
</ul>
<p>
  <a href="${params.appUrl}/rezerwacje/${params.bookingId}">Zaakceptuj lub odrzuć propozycję →</a>
</p>`
	};
}
function tplChangeRequestSubmitted(params) {
	return {
		subject: `Wniosek o zmianę rezerwacji — ${params.roomName}`,
		html: `<p><strong>${params.requesterName}</strong> złożył wniosek o zmianę zatwierdzonej rezerwacji sali <strong>${params.roomName}</strong>.</p>
<p><a href="${params.appUrl}/admin/rezerwacje/${params.bookingId}">Przejdź do wniosku →</a></p>`
	};
}
function tplBookingEdited(params) {
	return {
		subject: `Rezerwacja zaktualizowana — ${params.roomName} (${params.date})`,
		html: `<p>Twoja rezerwacja została <strong>zaktualizowana</strong> przez administratora.</p>
<ul>
  <li><strong>Sala:</strong> ${params.roomName}</li>
  <li><strong>Data:</strong> ${params.date}</li>
  <li><strong>Godziny:</strong> ${params.startTime}–${params.endTime}</li>
  ${params.adminNote ? `<li><strong>Notatka:</strong> ${params.adminNote}</li>` : ""}
</ul>
<p><a href="${params.appUrl}/rezerwacje/${params.bookingId}">Zobacz rezerwację →</a></p>`
	};
}
function tplAccountCreated(params) {
	return {
		subject: "Twoje konto w systemie rezerwacji Lafrentz",
		html: `<p>Cześć ${params.name},</p>
<p>Twoje konto w systemie rezerwacji sal zostało utworzone.</p>
<ul>
  <li><strong>Login:</strong> Twój adres e-mail</li>
  <li><strong>Hasło tymczasowe:</strong> <code>${params.tempPassword}</code></li>
</ul>
<p>Przy pierwszym logowaniu zostaniesz poproszony o zmianę hasła.</p>
<p><a href="${params.appUrl}/login">Zaloguj się →</a></p>`
	};
}
//#endregion
//#region app/routes/rezerwacje.nowa.tsx
var rezerwacje_nowa_exports = /* @__PURE__ */ __exportAll({
	action: () => action$6,
	default: () => rezerwacje_nowa_default,
	loader: () => loader$9
});
async function loader$9({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const url = new URL(request.url);
	const prefilledRoom = url.searchParams.get("sala");
	const prefilledDate = url.searchParams.get("data") ?? "";
	const prefilledFrom = url.searchParams.get("od") ?? "";
	const prefilledTo = url.searchParams.get("do") ?? "";
	return {
		user,
		rooms: (await queryAll(env.DB, "SELECT id, name, category, size_label FROM rooms WHERE is_active = 1 ORDER BY sort_order")).filter((r) => {
			if (r.category === "board") return canDirectBookBoardRoom(user.role);
			return true;
		}),
		prefilledRoom,
		prefilledDate,
		prefilledFrom,
		prefilledTo
	};
}
async function action$6({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const form = await request.formData();
	const roomId = parseInt(form.get("room_id"), 10);
	const date = form.get("date");
	const startTime = form.get("start_time");
	const endTime = form.get("end_time");
	const title = form.get("title")?.trim() || null;
	const attendeeCount = form.get("attendee_count") ? parseInt(form.get("attendee_count"), 10) : null;
	const attendeeEmailsRaw = form.get("attendee_emails")?.trim();
	const attendeeEmails = attendeeEmailsRaw ? JSON.stringify(attendeeEmailsRaw.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)) : null;
	const requesterNote = form.get("requester_note")?.trim() || null;
	if (!roomId || !date || !startTime || !endTime) return data({ error: "Wypełnij wymagane pola." }, { status: 400 });
	if (startTime >= endTime) return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
	if (((await queryOne(env.DB, `SELECT COUNT(*) as n FROM bookings
     WHERE room_id = ? AND date = ? AND status = 'approved'
       AND start_time < ? AND end_time > ?`, [
		roomId,
		date,
		endTime,
		startTime
	]))?.n ?? 0) > 0) return data({ error: "Ta sala jest już zarezerwowana w wybranym terminie. Wybierz inny czas lub salę." }, { status: 409 });
	const room = await queryOne(env.DB, "SELECT * FROM rooms WHERE id = ?", [roomId]);
	if (!room) return data({ error: "Nieznana sala." }, { status: 400 });
	const isDirect = room.category === "board" ? canDirectBookBoardRoom(user.role) : canDirectBookGeneralRoom(user.role);
	const status = isDirect ? "approved" : "pending";
	const bookingId = (await execute(env.DB, `INSERT INTO bookings
       (room_id, requester_id, created_by_admin_id, title, date, start_time, end_time,
        attendee_count, attendee_emails, status, requester_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
		roomId,
		user.id,
		isDirect ? user.id : null,
		title,
		date,
		startTime,
		endTime,
		attendeeCount,
		attendeeEmails,
		status,
		requesterNote
	])).meta.last_row_id;
	await logAction(env.DB, {
		userId: user.id,
		action: isDirect ? "booking.direct_created" : "booking.requested",
		entityType: "booking",
		entityId: bookingId,
		details: {
			roomId,
			date,
			startTime,
			endTime,
			status
		},
		ipAddress: request.headers.get("CF-Connecting-IP")
	});
	if (status === "pending") {
		const onDutyAdmins = await queryAll(env.DB, `SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active = 1 AND on_duty = 1`);
		const notifyAdmins = onDutyAdmins.length > 0 ? onDutyAdmins : await queryAll(env.DB, `SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active = 1`);
		const appUrl = new URL(request.url).origin;
		const tpl = tplNewRequest({
			requesterName: user.name,
			roomName: room.name,
			date,
			startTime,
			endTime,
			note: requesterNote,
			bookingId,
			appUrl
		});
		await sendEmail(env, {
			to: notifyAdmins.map((a) => a.email),
			...tpl
		});
	}
	return redirect(`/rezerwacje/${bookingId}`);
}
var rezerwacje_nowa_default = UNSAFE_withComponentProps(function NowaRezerwacja({ loaderData, actionData }) {
	const { user, rooms, prefilledRoom, prefilledDate, prefilledFrom, prefilledTo } = loaderData;
	const pending = useNavigation().state === "submitting";
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-xl mx-auto px-4 py-8",
		children: [/* @__PURE__ */ jsx("h1", {
			className: "text-2xl font-bold text-gray-900 mb-6",
			children: "Nowa rezerwacja"
		}), /* @__PURE__ */ jsxs(Form, {
			method: "post",
			className: "space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm",
			children: [
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Sala *"
				}), /* @__PURE__ */ jsxs("select", {
					name: "room_id",
					required: true,
					defaultValue: prefilledRoom ?? "",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: "— wybierz salę —"
					}), rooms.map((r) => /* @__PURE__ */ jsxs("option", {
						value: r.id,
						children: [r.name, r.size_label ? ` (${r.size_label})` : ""]
					}, r.id))]
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Tytuł spotkania"
				}), /* @__PURE__ */ jsx("input", {
					name: "title",
					type: "text",
					placeholder: "np. Spotkanie z klientem",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Data *"
				}), /* @__PURE__ */ jsx("input", {
					name: "date",
					type: "date",
					required: true,
					defaultValue: prefilledDate,
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Od *"
					}), /* @__PURE__ */ jsx("input", {
						name: "start_time",
						type: "time",
						required: true,
						defaultValue: prefilledFrom,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Do *"
					}), /* @__PURE__ */ jsx("input", {
						name: "end_time",
						type: "time",
						required: true,
						defaultValue: prefilledTo,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] })]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Liczba uczestników"
				}), /* @__PURE__ */ jsx("input", {
					name: "attendee_count",
					type: "number",
					min: "1",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: ["Adresy e-mail uczestników ", /* @__PURE__ */ jsx("span", {
						className: "text-gray-400 font-normal",
						children: "(opcjonalnie, oddzielone przecinkami)"
					})]
				}), /* @__PURE__ */ jsx("textarea", {
					name: "attendee_emails",
					rows: 2,
					placeholder: "jan.kowalski@lafrentz.pl, anna.nowak@lafrentz.pl",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: ["Uwagi ", /* @__PURE__ */ jsx("span", {
						className: "text-gray-400 font-normal",
						children: "(opcjonalnie)"
					})]
				}), /* @__PURE__ */ jsx("textarea", {
					name: "requester_note",
					rows: 2,
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
				})] }),
				actionData?.error && /* @__PURE__ */ jsx("p", {
					className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
					children: actionData.error
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex gap-3 pt-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: pending,
						className: "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors",
						children: pending ? "Wysyłam…" : "Złóż wniosek"
					}), /* @__PURE__ */ jsx("a", {
						href: "/",
						className: "px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors",
						children: "Anuluj"
					})]
				})
			]
		})]
	});
});
//#endregion
//#region app/routes/rezerwacje.$id.tsx
var rezerwacje_$id_exports = /* @__PURE__ */ __exportAll({
	action: () => action$5,
	default: () => rezerwacje_$id_default,
	loader: () => loader$8
});
async function loader$8({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const booking = await queryOne(env.DB, `SELECT b.*, r.name as room_name, u.name as requester_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.id = ?`, [params.id]);
	if (!booking) throw new Response(null, { status: 404 });
	if (booking.requester_id !== user.id && !isAdmin(user.role)) throw new Response(null, { status: 403 });
	return {
		user,
		booking,
		changeRequests: await queryAll(env.DB, `SELECT cr.*, u.name as requester_name
     FROM booking_change_requests cr
     JOIN users u ON u.id = cr.requester_id
     WHERE cr.booking_id = ?
     ORDER BY cr.created_at DESC`, [booking.id])
	};
}
async function action$5({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const form = await request.formData();
	const _action = form.get("_action");
	const bookingId = parseInt(params.id, 10);
	const booking = await queryOne(env.DB, "SELECT * FROM bookings WHERE id = ?", [bookingId]);
	if (!booking) throw new Response(null, { status: 404 });
	const appUrl = new URL(request.url).origin;
	if (_action === "approve") {
		if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
		const adminNote = form.get("admin_note")?.trim() || null;
		if (((await queryOne(env.DB, `SELECT COUNT(*) as n FROM bookings
       WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
         AND start_time < ? AND end_time > ?`, [
			booking.room_id,
			booking.date,
			bookingId,
			booking.end_time,
			booking.start_time
		]))?.n ?? 0) > 0) return data({ error: "Nie można zatwierdzić — sala jest już zarezerwowana w tym terminie przez inną rezerwację." }, { status: 409 });
		if (!(await execute(env.DB, `UPDATE bookings SET status='approved', admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status IN ('pending','counter_proposed')`, [
			adminNote,
			bookingId,
			booking.version
		])).meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });
		const room = await queryOne(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
		const emails = [(await queryOne(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id])).email];
		if (booking.attendee_emails) try {
			emails.push(...JSON.parse(booking.attendee_emails));
		} catch {}
		await sendEmail(env, {
			to: emails,
			...tplApproved({
				roomName: room.name,
				date: booking.date,
				startTime: booking.start_time,
				endTime: booking.end_time,
				adminNote
			})
		});
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.approved",
			entityType: "booking",
			entityId: bookingId
		});
	} else if (_action === "reject") {
		if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
		const adminNote = form.get("admin_note")?.trim() || null;
		if (!(await execute(env.DB, `UPDATE bookings SET status='rejected', admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=?`, [
			adminNote,
			bookingId,
			booking.version
		])).meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });
		const room = await queryOne(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
		const requester = await queryOne(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id]);
		const tpl = tplRejected({
			roomName: room.name,
			date: booking.date,
			adminNote
		});
		await sendEmail(env, {
			to: requester.email,
			...tpl
		});
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.rejected",
			entityType: "booking",
			entityId: bookingId
		});
	} else if (_action === "counter") {
		if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
		const counterDate = form.get("counter_date");
		const counterStart = form.get("counter_start_time");
		const counterEnd = form.get("counter_end_time");
		const adminNote = form.get("admin_note")?.trim() || null;
		if (!counterDate || !counterStart || !counterEnd) return data({ error: "Podaj pełny nowy termin." }, { status: 400 });
		if (!(await execute(env.DB, `UPDATE bookings SET status='counter_proposed', counter_date=?, counter_start_time=?, counter_end_time=?,
        admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='pending'`, [
			counterDate,
			counterStart,
			counterEnd,
			adminNote,
			bookingId,
			booking.version
		])).meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });
		const room = await queryOne(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
		const requester = await queryOne(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id]);
		const tpl = tplCounterProposed({
			roomName: room.name,
			originalDate: booking.date,
			counterDate,
			counterStart,
			counterEnd,
			adminNote,
			bookingId,
			appUrl
		});
		await sendEmail(env, {
			to: requester.email,
			...tpl
		});
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.counter_proposed",
			entityType: "booking",
			entityId: bookingId
		});
	} else if (_action === "accept_counter") {
		if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
		if (((await queryOne(env.DB, `SELECT COUNT(*) as n FROM bookings
       WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
         AND start_time < ? AND end_time > ?`, [
			booking.room_id,
			booking.counter_date,
			bookingId,
			booking.counter_end_time,
			booking.counter_start_time
		]))?.n ?? 0) > 0) return data({ error: "Proponowany termin jest już zajęty. Skontaktuj się z administratorem." }, { status: 409 });
		if (!(await execute(env.DB, `UPDATE bookings SET status='approved', date=counter_date, start_time=counter_start_time, end_time=counter_end_time,
        counter_date=NULL, counter_start_time=NULL, counter_end_time=NULL, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='counter_proposed'`, [bookingId, booking.version])).meta.changes) return data({ error: "Wystąpił błąd — odśwież stronę." }, { status: 409 });
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.counter_accepted",
			entityType: "booking",
			entityId: bookingId
		});
	} else if (_action === "reject_counter") {
		if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
		if (!(await execute(env.DB, `UPDATE bookings SET status='rejected', version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='counter_proposed'`, [bookingId, booking.version])).meta.changes) return data({ error: "Wystąpił błąd — odśwież stronę." }, { status: 409 });
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.counter_rejected",
			entityType: "booking",
			entityId: bookingId
		});
	} else if (_action === "delete") {
		if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
		await logAction(env.DB, {
			userId: user.id,
			action: "booking.deleted",
			entityType: "booking",
			entityId: bookingId,
			details: {
				room_id: booking.room_id,
				date: booking.date,
				status: booking.status
			}
		});
		await execute(env.DB, "DELETE FROM bookings WHERE id = ?", [bookingId]);
		return redirect("/admin/panel");
	}
	return redirect(`/rezerwacje/${bookingId}`);
}
var STATUS_LABELS$1 = {
	pending: "Oczekuje",
	approved: "Zatwierdzona",
	rejected: "Odrzucona",
	counter_proposed: "Kontrpropozycja"
};
var STATUS_COLORS$1 = {
	pending: "bg-amber-100 text-amber-800",
	approved: "bg-green-100 text-green-800",
	rejected: "bg-red-100 text-red-800",
	counter_proposed: "bg-orange-100 text-orange-800"
};
var rezerwacje_$id_default = UNSAFE_withComponentProps(function BookingDetail({ loaderData, actionData }) {
	const { user, booking, changeRequests } = loaderData;
	const pending = useNavigation().state === "submitting";
	const isOwner = booking.requester_id === user.id;
	const isAdminUser = isAdmin(user.role);
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-2xl mx-auto px-4 py-8 space-y-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsxs("h1", {
					className: "text-2xl font-bold text-gray-900",
					children: ["Rezerwacja #", booking.id]
				}), /* @__PURE__ */ jsx(Link, {
					to: "/",
					className: "text-sm text-gray-500 hover:text-gray-700",
					children: "← Kalendarz"
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS$1[booking.status]}`,
				children: STATUS_LABELS$1[booking.status]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm",
				children: [
					/* @__PURE__ */ jsx(Row, {
						label: "Sala",
						value: booking.room_name ?? "—"
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Data",
						value: booking.date
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Godziny",
						value: `${booking.start_time}–${booking.end_time}`
					}),
					booking.title && /* @__PURE__ */ jsx(Row, {
						label: "Tytuł",
						value: booking.title
					}),
					booking.attendee_count && /* @__PURE__ */ jsx(Row, {
						label: "Uczestnicy",
						value: `${booking.attendee_count} os.`
					}),
					booking.requester_note && /* @__PURE__ */ jsx(Row, {
						label: "Uwagi",
						value: booking.requester_note
					}),
					isAdminUser && /* @__PURE__ */ jsx(Row, {
						label: "Składający",
						value: booking.requester_name ?? "—"
					}),
					booking.admin_note && /* @__PURE__ */ jsx(Row, {
						label: "Notatka admina",
						value: booking.admin_note
					})
				]
			}),
			booking.status === "counter_proposed" && /* @__PURE__ */ jsxs("div", {
				className: "bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-semibold text-orange-900",
						children: "Proponowany nowy termin"
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Data",
						value: booking.counter_date ?? "—"
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Godziny",
						value: `${booking.counter_start_time}–${booking.counter_end_time}`
					}),
					isOwner && /* @__PURE__ */ jsxs("div", {
						className: "flex gap-3 pt-2",
						children: [/* @__PURE__ */ jsxs(Form, {
							method: "post",
							children: [/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "accept_counter"
							}), /* @__PURE__ */ jsxs("button", {
								type: "submit",
								disabled: pending,
								className: "flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg",
								children: [/* @__PURE__ */ jsx(CheckCircle, { size: 16 }), " Akceptuj"]
							})]
						}), /* @__PURE__ */ jsxs(Form, {
							method: "post",
							children: [/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "reject_counter"
							}), /* @__PURE__ */ jsxs("button", {
								type: "submit",
								disabled: pending,
								className: "flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg",
								children: [/* @__PURE__ */ jsx(XCircle, { size: 16 }), " Odrzuć"]
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-4",
				children: [(isOwner && booking.status === "pending" || isAdminUser) && /* @__PURE__ */ jsxs(Link, {
					to: `/rezerwacje/${booking.id}/edytuj`,
					className: "flex items-center gap-2 text-sm text-blue-600 hover:underline",
					children: [
						/* @__PURE__ */ jsx(Edit2, { size: 14 }),
						" ",
						isAdminUser && !isOwner ? "Edytuj rezerwację" : "Edytuj wniosek"
					]
				}), isAdminUser && /* @__PURE__ */ jsxs(Form, {
					method: "post",
					onSubmit: (e) => {
						if (!window.confirm("Usunąć tę rezerwację? Operacja jest nieodwracalna.")) e.preventDefault();
					},
					children: [/* @__PURE__ */ jsx("input", {
						type: "hidden",
						name: "_action",
						value: "delete"
					}), /* @__PURE__ */ jsxs("button", {
						type: "submit",
						disabled: pending,
						className: "flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors",
						children: [/* @__PURE__ */ jsx(Trash2, { size: 14 }), " Usuń rezerwację"]
					})]
				})]
			}),
			isOwner && booking.status === "approved" && /* @__PURE__ */ jsxs(Link, {
				to: `/rezerwacje/${booking.id}/zmiana`,
				className: "flex items-center gap-2 text-sm text-blue-600 hover:underline",
				children: [/* @__PURE__ */ jsx(RefreshCw, { size: 14 }), " Złóż wniosek o zmianę"]
			}),
			isAdminUser && (booking.status === "pending" || booking.status === "counter_proposed") && /* @__PURE__ */ jsx(AdminActions, {
				bookingId: booking.id,
				bookingVersion: booking.version,
				pending,
				actionData
			}),
			changeRequests.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-lg font-semibold text-gray-900",
					children: "Wnioski o zmianę"
				}), changeRequests.map((cr) => /* @__PURE__ */ jsxs("div", {
					className: "bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "text-sm font-medium text-gray-700",
								children: ["Wniosek #", cr.id]
							}), /* @__PURE__ */ jsx("span", {
								className: `text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS$1[cr.status]}`,
								children: STATUS_LABELS$1[cr.status]
							})]
						}),
						cr.new_date && /* @__PURE__ */ jsx(Row, {
							label: "Nowa data",
							value: cr.new_date
						}),
						cr.new_start_time && /* @__PURE__ */ jsx(Row, {
							label: "Nowe godziny",
							value: `${cr.new_start_time}–${cr.new_end_time}`
						}),
						cr.requester_note && /* @__PURE__ */ jsx(Row, {
							label: "Uwagi",
							value: cr.requester_note
						}),
						isAdminUser && cr.status === "pending" && /* @__PURE__ */ jsx(ChangeRequestActions, {
							crId: cr.id,
							bookingId: booking.id,
							pending
						})
					]
				}, cr.id))]
			}),
			actionData?.error && /* @__PURE__ */ jsx("p", {
				className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
				children: actionData.error
			})
		]
	});
});
function Row({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex gap-4 text-sm",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-gray-500 w-32 shrink-0",
			children: label
		}), /* @__PURE__ */ jsx("span", {
			className: "text-gray-900",
			children: value
		})]
	});
}
function AdminActions({ bookingId, bookingVersion, pending, actionData }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4",
		children: [
			/* @__PURE__ */ jsx("h3", {
				className: "font-semibold text-gray-900",
				children: "Akcje administratora"
			}),
			/* @__PURE__ */ jsx("input", {
				type: "hidden",
				name: "booking_version",
				value: bookingVersion
			}),
			/* @__PURE__ */ jsxs(Form, {
				method: "post",
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("input", {
						type: "hidden",
						name: "_action",
						value: "approve"
					}),
					/* @__PURE__ */ jsx("textarea", {
						name: "admin_note",
						rows: 1,
						placeholder: "Notatka (opcjonalnie)",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:outline-none"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "submit",
						disabled: pending,
						className: "flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg",
						children: [/* @__PURE__ */ jsx(CheckCircle, { size: 16 }), " Zatwierdź"]
					})
				]
			}),
			/* @__PURE__ */ jsx("hr", { className: "border-gray-200" }),
			/* @__PURE__ */ jsxs(Form, {
				method: "post",
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("input", {
						type: "hidden",
						name: "_action",
						value: "reject"
					}),
					/* @__PURE__ */ jsx("textarea", {
						name: "admin_note",
						rows: 1,
						placeholder: "Powód odrzucenia (opcjonalnie)",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:outline-none"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "submit",
						disabled: pending,
						className: "flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg",
						children: [/* @__PURE__ */ jsx(XCircle, { size: 16 }), " Odrzuć"]
					})
				]
			}),
			/* @__PURE__ */ jsx("hr", { className: "border-gray-200" }),
			/* @__PURE__ */ jsxs(Form, {
				method: "post",
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("input", {
						type: "hidden",
						name: "_action",
						value: "counter"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm font-medium text-gray-700",
						children: "Kontrpropozycja terminu"
					}),
					/* @__PURE__ */ jsx("input", {
						type: "date",
						name: "counter_date",
						required: true,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ jsx("input", {
							type: "time",
							name: "counter_start_time",
							required: true,
							className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
						}), /* @__PURE__ */ jsx("input", {
							type: "time",
							name: "counter_end_time",
							required: true,
							className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
						})]
					}),
					/* @__PURE__ */ jsx("textarea", {
						name: "admin_note",
						rows: 1,
						placeholder: "Notatka (opcjonalnie)",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-400 focus:outline-none"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "submit",
						disabled: pending,
						className: "flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg",
						children: [/* @__PURE__ */ jsx(Clock, { size: 16 }), " Zaproponuj inny termin"]
					})
				]
			})
		]
	});
}
function ChangeRequestActions({ crId, bookingId, pending }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex gap-2 pt-1",
		children: [/* @__PURE__ */ jsxs(Form, {
			method: "post",
			action: `/rezerwacje/${bookingId}/zmiana`,
			children: [
				/* @__PURE__ */ jsx("input", {
					type: "hidden",
					name: "_action",
					value: "approve_cr"
				}),
				/* @__PURE__ */ jsx("input", {
					type: "hidden",
					name: "cr_id",
					value: crId
				}),
				/* @__PURE__ */ jsxs("button", {
					type: "submit",
					disabled: pending,
					className: "flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg",
					children: [/* @__PURE__ */ jsx(CheckCircle, { size: 14 }), " Zatwierdź zmianę"]
				})
			]
		}), /* @__PURE__ */ jsxs(Form, {
			method: "post",
			action: `/rezerwacje/${bookingId}/zmiana`,
			children: [
				/* @__PURE__ */ jsx("input", {
					type: "hidden",
					name: "_action",
					value: "reject_cr"
				}),
				/* @__PURE__ */ jsx("input", {
					type: "hidden",
					name: "cr_id",
					value: crId
				}),
				/* @__PURE__ */ jsxs("button", {
					type: "submit",
					disabled: pending,
					className: "flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg",
					children: [/* @__PURE__ */ jsx(XCircle, { size: 14 }), " Odrzuć"]
				})
			]
		})]
	});
}
//#endregion
//#region app/routes/rezerwacje.$id.edytuj.tsx
var rezerwacje_$id_edytuj_exports = /* @__PURE__ */ __exportAll({
	action: () => action$4,
	default: () => rezerwacje_$id_edytuj_default,
	loader: () => loader$7
});
async function loader$7({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const booking = await queryOne(env.DB, `SELECT b.*, r.name as room_name, u.name as requester_name, u.email as requester_email
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.id = ?`, [params.id]);
	if (!booking) throw new Response(null, { status: 404 });
	const adminUser = isAdmin(user.role);
	if (!adminUser) {
		if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
		if (booking.status !== "pending") return redirect(`/rezerwacje/${booking.id}`);
	}
	return {
		booking,
		isAdminUser: adminUser,
		rooms: adminUser ? await queryAll(env.DB, "SELECT id, name, category FROM rooms WHERE is_active=1 ORDER BY sort_order") : null
	};
}
async function action$4({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const form = await request.formData();
	const version = parseInt(form.get("version"), 10);
	const roomId = form.get("room_id") ? parseInt(form.get("room_id"), 10) : null;
	const date = form.get("date");
	const startTime = form.get("start_time");
	const endTime = form.get("end_time");
	const title = form.get("title")?.trim() || null;
	const attendeeCount = form.get("attendee_count") ? parseInt(form.get("attendee_count"), 10) : null;
	const attendeeEmailsRaw = form.get("attendee_emails")?.trim();
	const attendeeEmails = attendeeEmailsRaw ? JSON.stringify(attendeeEmailsRaw.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)) : null;
	const requesterNote = form.get("requester_note")?.trim() || null;
	const adminNote = form.get("admin_note")?.trim() || null;
	const notify = form.get("notify") ?? "none";
	const bookingId = parseInt(params.id, 10);
	const adminUser = isAdmin(user.role);
	const booking = await queryOne(env.DB, `SELECT b.*, u.email as requester_email FROM bookings b JOIN users u ON u.id=b.requester_id WHERE b.id=?`, [bookingId]);
	if (!booking) throw new Response(null, { status: 404 });
	if (!adminUser && booking.requester_id !== user.id) throw new Response(null, { status: 403 });
	if (startTime >= endTime) return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
	const targetRoomId = adminUser && roomId ? roomId : booking.room_id;
	if (((await queryOne(env.DB, `SELECT COUNT(*) as n FROM bookings
     WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
       AND start_time < ? AND end_time > ?`, [
		targetRoomId,
		date,
		bookingId,
		endTime,
		startTime
	]))?.n ?? 0) > 0) return data({ error: "Ta sala jest już zarezerwowana w wybranym terminie." }, { status: 409 });
	if (adminUser) {
		if (!(await execute(env.DB, `UPDATE bookings
       SET room_id=?, date=?, start_time=?, end_time=?, title=?, attendee_count=?, attendee_emails=?,
           requester_note=?, admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=?`, [
			targetRoomId,
			date,
			startTime,
			endTime,
			title,
			attendeeCount,
			attendeeEmails,
			requesterNote,
			adminNote,
			bookingId,
			version
		])).meta.changes) return data({ error: "Konflikt — ktoś inny zmodyfikował tę rezerwację. Odśwież i spróbuj ponownie." }, { status: 409 });
		if (notify !== "none") {
			const room = await queryOne(env.DB, "SELECT name FROM rooms WHERE id=?", [targetRoomId]);
			const appUrl = new URL(request.url).origin;
			const tpl = tplBookingEdited({
				roomName: room.name,
				date,
				startTime,
				endTime,
				adminNote,
				bookingId,
				appUrl
			});
			const recipients = [booking.requester_email];
			if (notify === "all" && booking.attendee_emails) try {
				recipients.push(...JSON.parse(booking.attendee_emails));
			} catch {}
			await sendEmail(env, {
				to: recipients,
				...tpl
			});
		}
	} else if (!(await execute(env.DB, `UPDATE bookings
       SET date=?, start_time=?, end_time=?, title=?, attendee_count=?, attendee_emails=?,
           requester_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='pending' AND requester_id=?`, [
		date,
		startTime,
		endTime,
		title,
		attendeeCount,
		attendeeEmails,
		requesterNote,
		bookingId,
		version,
		user.id
	])).meta.changes) return data({ error: "Twój wniosek został właśnie przetworzony przez administratora. Edycja nie jest możliwa." }, { status: 409 });
	await logAction(env.DB, {
		userId: user.id,
		action: "booking.edited",
		entityType: "booking",
		entityId: bookingId,
		details: {
			date,
			startTime,
			endTime,
			editedByAdmin: adminUser
		}
	});
	return redirect(`/rezerwacje/${bookingId}`);
}
var rezerwacje_$id_edytuj_default = UNSAFE_withComponentProps(function EdytujRezerwacje({ loaderData, actionData }) {
	const { booking, isAdminUser, rooms } = loaderData;
	const pending = useNavigation().state === "submitting";
	const attendeeEmailsParsed = booking.attendee_emails ? JSON.parse(booking.attendee_emails).join(", ") : "";
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-xl mx-auto px-4 py-8",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between mb-6",
			children: [/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: isAdminUser ? "Edytuj rezerwację" : "Edytuj wniosek"
			}), /* @__PURE__ */ jsx(Link, {
				to: `/rezerwacje/${booking.id}`,
				className: "text-sm text-gray-500 hover:text-gray-700",
				children: "Anuluj"
			})]
		}), /* @__PURE__ */ jsxs(Form, {
			method: "post",
			className: "space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm",
			children: [
				/* @__PURE__ */ jsx("input", {
					type: "hidden",
					name: "version",
					value: booking.version
				}),
				isAdminUser && rooms ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Sala *"
				}), /* @__PURE__ */ jsx("select", {
					name: "room_id",
					defaultValue: booking.room_id,
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
					children: rooms.map((r) => /* @__PURE__ */ jsx("option", {
						value: r.id,
						children: r.name
					}, r.id))
				})] }) : /* @__PURE__ */ jsxs("p", {
					className: "text-sm text-gray-500",
					children: ["Sala: ", /* @__PURE__ */ jsx("strong", { children: booking.room_name })]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Tytuł spotkania"
				}), /* @__PURE__ */ jsx("input", {
					name: "title",
					type: "text",
					defaultValue: booking.title ?? "",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Data *"
				}), /* @__PURE__ */ jsx("input", {
					name: "date",
					type: "date",
					required: true,
					defaultValue: booking.date,
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Od *"
					}), /* @__PURE__ */ jsx("input", {
						name: "start_time",
						type: "time",
						required: true,
						defaultValue: booking.start_time,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Do *"
					}), /* @__PURE__ */ jsx("input", {
						name: "end_time",
						type: "time",
						required: true,
						defaultValue: booking.end_time,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] })]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Liczba uczestników"
				}), /* @__PURE__ */ jsx("input", {
					name: "attendee_count",
					type: "number",
					min: "1",
					defaultValue: booking.attendee_count ?? "",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Adresy e-mail uczestników"
				}), /* @__PURE__ */ jsx("textarea", {
					name: "attendee_emails",
					rows: 2,
					defaultValue: attendeeEmailsParsed,
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Uwagi zgłaszającego"
				}), /* @__PURE__ */ jsx("textarea", {
					name: "requester_note",
					rows: 2,
					defaultValue: booking.requester_note ?? "",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }),
				isAdminUser && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "block text-sm font-medium text-gray-700 mb-1",
					children: "Notatka administratora"
				}), /* @__PURE__ */ jsx("textarea", {
					name: "admin_note",
					rows: 2,
					defaultValue: booking.admin_note ?? "",
					className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
				})] }), /* @__PURE__ */ jsxs("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm font-medium text-gray-700",
						children: "Powiadomienia e-mail"
					}), /* @__PURE__ */ jsx("div", {
						className: "flex flex-col gap-2",
						children: [
							{
								value: "none",
								label: "Nie wysyłaj"
							},
							{
								value: "organiser",
								label: "Wyślij do organizatora"
							},
							{
								value: "all",
								label: "Wyślij do organizatora i wszystkich uczestników"
							}
						].map((opt) => /* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-2.5 cursor-pointer text-sm text-gray-700",
							children: [/* @__PURE__ */ jsx("input", {
								type: "radio",
								name: "notify",
								value: opt.value,
								defaultChecked: opt.value === "none",
								className: "accent-blue-600"
							}), opt.label]
						}, opt.value))
					})]
				})] }),
				actionData?.error && /* @__PURE__ */ jsxs("div", {
					className: "text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "font-semibold",
							children: "Nie udało się zapisać zmian"
						}),
						/* @__PURE__ */ jsx("p", { children: actionData.error }),
						/* @__PURE__ */ jsx(Link, {
							to: `/rezerwacje/${booking.id}`,
							className: "text-red-800 underline mt-1 inline-block",
							children: "Zobacz aktualny stan wniosku →"
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex gap-3 pt-2",
					children: /* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: pending,
						className: "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors",
						children: pending ? "Zapisuję…" : "Zapisz zmiany"
					})
				})
			]
		})]
	});
});
//#endregion
//#region app/routes/rezerwacje.$id.zmiana.tsx
var rezerwacje_$id_zmiana_exports = /* @__PURE__ */ __exportAll({
	action: () => action$3,
	default: () => rezerwacje_$id_zmiana_default,
	loader: () => loader$6
});
async function loader$6({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const booking = await queryOne(env.DB, `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`, [params.id]);
	if (!booking) throw new Response(null, { status: 404 });
	if (booking.requester_id !== user.id && !isAdmin(user.role)) throw new Response(null, { status: 403 });
	if (booking.status !== "approved") return redirect(`/rezerwacje/${booking.id}`);
	return { booking };
}
async function action$3({ params, request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const form = await request.formData();
	const _action = form.get("_action");
	const bookingId = parseInt(params.id, 10);
	const booking = await queryOne(env.DB, `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`, [bookingId]);
	if (!booking) throw new Response(null, { status: 404 });
	if (_action === "approve_cr" || _action === "reject_cr") {
		if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
		const crId = parseInt(form.get("cr_id"), 10);
		const adminNote = form.get("admin_note")?.trim() || null;
		const cr = await queryOne(env.DB, "SELECT * FROM booking_change_requests WHERE id=? AND booking_id=? AND status='pending'", [crId, bookingId]);
		if (!cr) return data({ error: "Nie znaleziono wniosku o zmianę." }, { status: 404 });
		if (_action === "approve_cr") {
			const updates = [];
			const vals = [];
			if (cr.new_date) {
				updates.push("date=?");
				vals.push(cr.new_date);
			}
			if (cr.new_start_time) {
				updates.push("start_time=?");
				vals.push(cr.new_start_time);
			}
			if (cr.new_end_time) {
				updates.push("end_time=?");
				vals.push(cr.new_end_time);
			}
			if (cr.new_title) {
				updates.push("title=?");
				vals.push(cr.new_title);
			}
			if (cr.new_attendee_count) {
				updates.push("attendee_count=?");
				vals.push(cr.new_attendee_count);
			}
			if (cr.new_attendee_emails) {
				updates.push("attendee_emails=?");
				vals.push(cr.new_attendee_emails);
			}
			if (updates.length > 0) await execute(env.DB, `UPDATE bookings SET ${updates.join(", ")}, version=version+1, updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND status='approved'`, [...vals, bookingId]);
			await execute(env.DB, "UPDATE booking_change_requests SET status='approved', admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [adminNote, crId]);
			await logAction(env.DB, {
				userId: user.id,
				action: "change_request.approved",
				entityType: "booking",
				entityId: bookingId
			});
		} else {
			await execute(env.DB, "UPDATE booking_change_requests SET status='rejected', admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [adminNote, crId]);
			await logAction(env.DB, {
				userId: user.id,
				action: "change_request.rejected",
				entityType: "booking",
				entityId: bookingId
			});
		}
		return redirect(`/rezerwacje/${bookingId}`);
	}
	if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
	if (booking.status !== "approved") return data({ error: "Można zmieniać tylko zatwierdzone rezerwacje." }, { status: 400 });
	const newDate = form.get("new_date")?.trim() || null;
	const newStartTime = form.get("new_start_time")?.trim() || null;
	const newEndTime = form.get("new_end_time")?.trim() || null;
	const newTitle = form.get("new_title")?.trim() || null;
	const newAttendeeCount = form.get("new_attendee_count") ? parseInt(form.get("new_attendee_count"), 10) : null;
	const newAttendeeEmailsRaw = form.get("new_attendee_emails")?.trim();
	const newAttendeeEmails = newAttendeeEmailsRaw ? JSON.stringify(newAttendeeEmailsRaw.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)) : null;
	const requesterNote = form.get("requester_note")?.trim() || null;
	if (!newDate && !newStartTime && !newEndTime && !newTitle) return data({ error: "Podaj przynajmniej jedną zmianę." }, { status: 400 });
	await execute(env.DB, `INSERT INTO booking_change_requests
       (booking_id, requester_id, new_date, new_start_time, new_end_time, new_title,
        new_attendee_count, new_attendee_emails, requester_note)
     VALUES (?,?,?,?,?,?,?,?,?)`, [
		bookingId,
		user.id,
		newDate,
		newStartTime,
		newEndTime,
		newTitle,
		newAttendeeCount,
		newAttendeeEmails,
		requesterNote
	]);
	await logAction(env.DB, {
		userId: user.id,
		action: "change_request.submitted",
		entityType: "booking",
		entityId: bookingId
	});
	const onDutyAdmins = await queryAll(env.DB, "SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active=1 AND on_duty=1");
	const notifyAdmins = onDutyAdmins.length > 0 ? onDutyAdmins : await queryAll(env.DB, "SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active=1");
	const appUrl = new URL(request.url).origin;
	const tpl = tplChangeRequestSubmitted({
		requesterName: user.name,
		roomName: booking.room_name,
		bookingId,
		appUrl
	});
	await sendEmail(env, {
		to: notifyAdmins.map((a) => a.email),
		...tpl
	});
	return redirect(`/rezerwacje/${bookingId}`);
}
var rezerwacje_$id_zmiana_default = UNSAFE_withComponentProps(function ZmianaRezerwacji({ loaderData, actionData }) {
	const { booking } = loaderData;
	const pending = useNavigation().state === "submitting";
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-xl mx-auto px-4 py-8",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between mb-6",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-bold text-gray-900",
					children: "Wniosek o zmianę rezerwacji"
				}), /* @__PURE__ */ jsx(Link, {
					to: `/rezerwacje/${booking.id}`,
					className: "text-sm text-gray-500 hover:text-gray-700",
					children: "Anuluj"
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800",
				children: [
					"Aktualna rezerwacja: ",
					/* @__PURE__ */ jsx("strong", { children: booking.room_name }),
					", ",
					booking.date,
					", ",
					booking.start_time,
					"–",
					booking.end_time
				]
			}),
			/* @__PURE__ */ jsxs(Form, {
				method: "post",
				className: "space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-gray-500",
						children: "Wypełnij tylko te pola, które chcesz zmienić."
					}),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Nowy tytuł"
					}), /* @__PURE__ */ jsx("input", {
						name: "new_title",
						type: "text",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Nowa data"
					}), /* @__PURE__ */ jsx("input", {
						name: "new_date",
						type: "date",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							children: "Nowa godzina od"
						}), /* @__PURE__ */ jsx("input", {
							name: "new_start_time",
							type: "time",
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							children: "Nowa godzina do"
						}), /* @__PURE__ */ jsx("input", {
							name: "new_end_time",
							type: "time",
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})] })]
					}),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Nowa liczba uczestników"
					}), /* @__PURE__ */ jsx("input", {
						name: "new_attendee_count",
						type: "number",
						min: "1",
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Nowe adresy uczestników"
					}), /* @__PURE__ */ jsx("textarea", {
						name: "new_attendee_emails",
						rows: 2,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-sm font-medium text-gray-700 mb-1",
						children: "Uwagi"
					}), /* @__PURE__ */ jsx("textarea", {
						name: "requester_note",
						rows: 2,
						className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
					})] }),
					actionData?.error && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
						children: actionData.error
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex gap-3 pt-2",
						children: /* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: pending,
							className: "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors",
							children: pending ? "Wysyłam…" : "Złóż wniosek o zmianę"
						})
					})
				]
			})
		]
	});
});
//#endregion
//#region app/routes/ustawienia.tsx
var ustawienia_exports = /* @__PURE__ */ __exportAll({
	action: () => action$2,
	default: () => ustawienia_default,
	loader: () => loader$5
});
async function loader$5({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	return {
		user: requireUser(await getSessionUser(env.DB, token)),
		rooms: await queryAll(env.DB, "SELECT id, name, category FROM rooms WHERE is_active=1 ORDER BY sort_order"),
		forcePasswordChange: new URL(request.url).searchParams.get("zmien-haslo") === "1"
	};
}
async function action$2({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	const form = await request.formData();
	const _action = form.get("_action");
	if (_action === "change_password") {
		const current = form.get("current_password");
		const next = form.get("new_password");
		const confirm = form.get("confirm_password");
		if (!next || next.length < 8) return data({ error: "Hasło musi mieć co najmniej 8 znaków." }, { status: 400 });
		if (next !== confirm) return data({ error: "Hasła nie są identyczne." }, { status: 400 });
		if (!user.must_change_password) {
			if (!current) return data({ error: "Podaj aktualne hasło." }, { status: 400 });
			if (!await verifyPassword(current, user.password_hash)) return data({ error: "Aktualne hasło jest nieprawidłowe." }, { status: 401 });
		}
		const hash = await hashPassword(next);
		await execute(env.DB, "UPDATE users SET password_hash=?, must_change_password=0, updated_at=CURRENT_TIMESTAMP WHERE id=?", [hash, user.id]);
		return redirect("/ustawienia?ok=1");
	}
	if (_action === "preferred_room") {
		const roomId = form.get("preferred_room_id") ? parseInt(form.get("preferred_room_id"), 10) : null;
		await execute(env.DB, "UPDATE users SET preferred_room_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [roomId, user.id]);
		return redirect("/ustawienia?ok=1");
	}
	if (_action === "toggle_duty") {
		if (user.role === "admin" || user.role === "super_admin") await execute(env.DB, "UPDATE users SET on_duty=CASE WHEN on_duty=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?", [user.id]);
		return redirect("/ustawienia");
	}
	return null;
}
var ustawienia_default = UNSAFE_withComponentProps(function Ustawienia({ loaderData, actionData }) {
	const { user, rooms, forcePasswordChange } = loaderData;
	const nav = useNavigation();
	const [searchParams] = useSearchParams();
	const pending = nav.state === "submitting";
	const saved = searchParams.get("ok") === "1";
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-xl mx-auto px-4 py-8 space-y-8",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: "Ustawienia"
			}),
			saved && /* @__PURE__ */ jsx("div", {
				className: "bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm",
				children: "Zmiany zostały zapisane."
			}),
			forcePasswordChange && /* @__PURE__ */ jsx("div", {
				className: "bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm",
				children: "Musisz ustawić nowe hasło przed kontynuowaniem."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "font-semibold text-gray-900",
					children: "Zmiana hasła"
				}), /* @__PURE__ */ jsxs(Form, {
					method: "post",
					className: "space-y-4",
					children: [
						/* @__PURE__ */ jsx("input", {
							type: "hidden",
							name: "_action",
							value: "change_password"
						}),
						!user.must_change_password && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							children: "Aktualne hasło"
						}), /* @__PURE__ */ jsx("input", {
							name: "current_password",
							type: "password",
							autoComplete: "current-password",
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							children: "Nowe hasło"
						}), /* @__PURE__ */ jsx("input", {
							name: "new_password",
							type: "password",
							autoComplete: "new-password",
							required: true,
							minLength: 8,
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "block text-sm font-medium text-gray-700 mb-1",
							children: "Powtórz nowe hasło"
						}), /* @__PURE__ */ jsx("input", {
							name: "confirm_password",
							type: "password",
							autoComplete: "new-password",
							required: true,
							className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})] }),
						actionData?.error && /* @__PURE__ */ jsx("p", {
							className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
							children: actionData.error
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: pending,
							className: "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg",
							children: pending ? "Zapisuję…" : "Zmień hasło"
						})
					]
				})]
			}),
			!forcePasswordChange && /* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-gray-900",
						children: "Ulubiona sala"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-gray-500",
						children: "Ta sala będzie domyślnie otwarta po zalogowaniu."
					}),
					/* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "preferred_room"
							}),
							/* @__PURE__ */ jsxs("select", {
								name: "preferred_room_id",
								defaultValue: user.preferred_room_id ?? "",
								className: "flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
								children: [/* @__PURE__ */ jsx("option", {
									value: "",
									children: "— brak preferencji —"
								}), rooms.map((r) => /* @__PURE__ */ jsx("option", {
									value: r.id,
									children: r.name
								}, r.id))]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: pending,
								className: "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg",
								children: "Zapisz"
							})
						]
					})
				]
			}),
			(user.role === "admin" || user.role === "super_admin") && !forcePasswordChange && /* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-gray-900",
						children: "Dyżur"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-gray-500",
						children: "Gdy dyżur jest aktywny, otrzymujesz e-maile o nowych wnioskach o rezerwację."
					}),
					/* @__PURE__ */ jsxs(Form, {
						method: "post",
						children: [/* @__PURE__ */ jsx("input", {
							type: "hidden",
							name: "_action",
							value: "toggle_duty"
						}), /* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: pending,
							className: `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${user.on_duty ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`,
							children: user.on_duty ? "Dyżur aktywny — wyłącz" : "Dyżur nieaktywny — włącz"
						})]
					})
				]
			})
		]
	});
});
//#endregion
//#region app/routes/admin.rezerwacje.tsx
var admin_rezerwacje_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_rezerwacje_default,
	loader: () => loader$4
});
async function loader$4({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (!canManageBookings(requireUser(await getSessionUser(env.DB, token)).role)) throw new Response(null, { status: 403 });
	return {
		pendingBookings: await queryAll(env.DB, `SELECT b.*, r.name as room_name, u.name as requester_name
     FROM bookings b
     JOIN rooms r ON r.id=b.room_id
     JOIN users u ON u.id=b.requester_id
     WHERE b.status IN ('pending','counter_proposed')
     ORDER BY b.date ASC, b.start_time ASC`),
		pendingChanges: await queryAll(env.DB, `SELECT cr.*, u.name as requester_name, r.name as booking_room, b.date as booking_date
     FROM booking_change_requests cr
     JOIN bookings b ON b.id=cr.booking_id
     JOIN rooms r ON r.id=b.room_id
     JOIN users u ON u.id=cr.requester_id
     WHERE cr.status='pending'
     ORDER BY cr.created_at ASC`)
	};
}
var STATUS_LABELS = {
	pending: "Oczekuje",
	counter_proposed: "Kontrpropozycja"
};
var STATUS_COLORS = {
	pending: "bg-amber-100 text-amber-800",
	counter_proposed: "bg-orange-100 text-orange-800"
};
var admin_rezerwacje_default = UNSAFE_withComponentProps(function AdminRezerwacje({ loaderData }) {
	const { pendingBookings, pendingChanges } = loaderData;
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-4xl mx-auto px-4 py-8 space-y-8",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: "Wnioski do rozpatrzenia"
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ jsxs("h2", {
					className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx(Clock, { size: 18 }),
						"Wnioski o rezerwację (",
						pendingBookings.length,
						")"
					]
				}), pendingBookings.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-sm text-gray-400 py-4",
					children: "Brak oczekujących wniosków."
				}) : /* @__PURE__ */ jsx("div", {
					className: "space-y-2",
					children: pendingBookings.map((b) => /* @__PURE__ */ jsxs(Link, {
						to: `/rezerwacje/${b.id}`,
						className: "flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-medium text-gray-900",
								children: b.room_name
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-sm text-gray-500",
								children: [
									b.date,
									", ",
									b.start_time,
									"–",
									b.end_time,
									" · ",
									b.requester_name
								]
							}),
							b.title && /* @__PURE__ */ jsx("p", {
								className: "text-xs text-gray-400 mt-0.5",
								children: b.title
							})
						] }), /* @__PURE__ */ jsx("span", {
							className: `text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`,
							children: STATUS_LABELS[b.status]
						})]
					}, b.id))
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ jsxs("h2", {
					className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx(RefreshCw, { size: 18 }),
						"Wnioski o zmianę rezerwacji (",
						pendingChanges.length,
						")"
					]
				}), pendingChanges.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-sm text-gray-400 py-4",
					children: "Brak wniosków o zmianę."
				}) : /* @__PURE__ */ jsx("div", {
					className: "space-y-2",
					children: pendingChanges.map((cr) => /* @__PURE__ */ jsxs(Link, {
						to: `/rezerwacje/${cr.booking_id}`,
						className: "flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-medium text-gray-900",
								children: cr.booking_room
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-sm text-gray-500",
								children: [
									cr.booking_date,
									" · ",
									cr.requester_name
								]
							}),
							cr.requester_note && /* @__PURE__ */ jsx("p", {
								className: "text-xs text-gray-400 mt-0.5",
								children: cr.requester_note
							})
						] }), /* @__PURE__ */ jsx("span", {
							className: "text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-800",
							children: "Zmiana"
						})]
					}, cr.id))
				})]
			})
		]
	});
});
//#endregion
//#region app/routes/admin.panel.tsx
var admin_panel_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_panel_default,
	loader: () => loader$3
});
var PAGE_SIZE = 30;
async function loader$3({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (!canManageBookings(requireUser(await getSessionUser(env.DB, token)).role)) throw new Response(null, { status: 403 });
	const url = new URL(request.url);
	const filterRoom = url.searchParams.get("sala") ?? "";
	const filterStatus = url.searchParams.get("status") ?? "";
	const filterFrom = url.searchParams.get("od") ?? "";
	const filterTo = url.searchParams.get("do") ?? "";
	const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));
	const rooms = await queryAll(env.DB, "SELECT id, name FROM rooms ORDER BY sort_order");
	const conditions = [];
	const params = [];
	if (filterRoom) {
		conditions.push("b.room_id = ?");
		params.push(parseInt(filterRoom, 10));
	}
	if (filterStatus) {
		conditions.push("b.status = ?");
		params.push(filterStatus);
	}
	if (filterFrom) {
		conditions.push("b.date >= ?");
		params.push(filterFrom);
	}
	if (filterTo) {
		conditions.push("b.date <= ?");
		params.push(filterTo);
	}
	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const total = (await queryAll(env.DB, `SELECT COUNT(*) as n FROM bookings b ${where}`, params))[0]?.n ?? 0;
	return {
		bookings: await queryAll(env.DB, `SELECT b.*, r.name as room_name, u.name as requester_name, u.role as requester_role
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     ${where}
     ORDER BY b.date DESC, b.start_time DESC
     LIMIT ? OFFSET ?`, [
			...params,
			PAGE_SIZE,
			(page - 1) * PAGE_SIZE
		]),
		rooms,
		total,
		page,
		filterRoom,
		filterStatus,
		filterFrom,
		filterTo
	};
}
var STATUS_LABEL = {
	pending: "Oczekuje",
	approved: "Zatwierdzona",
	rejected: "Odrzucona",
	counter_proposed: "Kontrpropozycja"
};
var STATUS_COLOR = {
	pending: "bg-amber-100 text-amber-800",
	approved: "bg-green-100 text-green-800",
	rejected: "bg-gray-100 text-gray-500",
	counter_proposed: "bg-orange-100 text-orange-800"
};
var admin_panel_default = UNSAFE_withComponentProps(function AdminPanel({ loaderData }) {
	const { bookings, rooms, total, page, filterRoom, filterStatus, filterFrom, filterTo } = loaderData;
	const totalPages = Math.ceil(total / PAGE_SIZE);
	function buildUrl(overrides) {
		const p = {
			sala: filterRoom,
			status: filterStatus,
			od: filterFrom,
			do: filterTo,
			strona: String(page),
			...overrides
		};
		const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
		return `/admin/panel${qs ? `?${qs}` : ""}`;
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-6xl mx-auto px-4 py-8 space-y-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-bold text-gray-900",
					children: "Wszystkie rezerwacje"
				}), /* @__PURE__ */ jsxs("span", {
					className: "text-sm text-gray-400",
					children: [total, " łącznie"]
				})]
			}),
			/* @__PURE__ */ jsxs("form", {
				method: "get",
				className: "flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm",
				children: [
					/* @__PURE__ */ jsxs("select", {
						name: "sala",
						defaultValue: filterRoom,
						className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
						children: [/* @__PURE__ */ jsx("option", {
							value: "",
							children: "Wszystkie sale"
						}), rooms.map((r) => /* @__PURE__ */ jsx("option", {
							value: r.id,
							children: r.name
						}, r.id))]
					}),
					/* @__PURE__ */ jsxs("select", {
						name: "status",
						defaultValue: filterStatus,
						className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
						children: [
							/* @__PURE__ */ jsx("option", {
								value: "",
								children: "Wszystkie statusy"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "pending",
								children: "Oczekuje"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "approved",
								children: "Zatwierdzona"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "rejected",
								children: "Odrzucona"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "counter_proposed",
								children: "Kontrpropozycja"
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("label", {
							className: "text-sm text-gray-500",
							children: "Od"
						}), /* @__PURE__ */ jsx("input", {
							type: "date",
							name: "od",
							defaultValue: filterFrom,
							className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("label", {
							className: "text-sm text-gray-500",
							children: "Do"
						}), /* @__PURE__ */ jsx("input", {
							type: "date",
							name: "do",
							defaultValue: filterTo,
							className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						})]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors",
						children: "Filtruj"
					}),
					(filterRoom || filterStatus || filterFrom || filterTo) && /* @__PURE__ */ jsx("a", {
						href: "/admin/panel",
						className: "text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors",
						children: "Wyczyść"
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "bg-gray-50 border-b border-gray-200",
						children: /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Sala"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Data"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Godziny"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Tytuł"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Zgłaszający"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Status"
							})
						] })
					}), /* @__PURE__ */ jsxs("tbody", {
						className: "divide-y divide-gray-100",
						children: [bookings.length === 0 && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
							colSpan: 6,
							className: "px-4 py-10 text-center text-sm text-gray-400",
							children: "Brak rezerwacji spełniających kryteria."
						}) }), bookings.map((b) => /* @__PURE__ */ jsxs("tr", {
							className: "hover:bg-gray-50 transition-colors",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 font-medium text-gray-900 whitespace-nowrap",
									children: b.room_name
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-gray-700 whitespace-nowrap",
									children: formatDate(b.date)
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3 text-gray-600 whitespace-nowrap",
									children: [
										b.start_time,
										"–",
										b.end_time
									]
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-gray-700 max-w-48 truncate",
									children: b.title ?? /* @__PURE__ */ jsx("span", {
										className: "text-gray-300",
										children: "—"
									})
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3 whitespace-nowrap",
									children: [/* @__PURE__ */ jsx("span", {
										className: "text-gray-800",
										children: b.requester_name
									}), /* @__PURE__ */ jsx("span", {
										className: "ml-1.5 text-xs text-gray-400",
										children: ROLE_LABELS[b.requester_role]
									})]
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ jsxs(Link, {
										to: `/rezerwacje/${b.id}`,
										className: "inline-flex items-center gap-1.5 group",
										children: [/* @__PURE__ */ jsx("span", {
											className: `text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]}`,
											children: STATUS_LABEL[b.status] ?? b.status
										}), /* @__PURE__ */ jsx("span", {
											className: "text-xs text-gray-300 group-hover:text-blue-600 transition-colors",
											children: "→"
										})]
									})
								})
							]
						}, b.id))]
					})]
				})
			}),
			totalPages > 1 && /* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2 text-sm",
				children: [
					page > 1 && /* @__PURE__ */ jsx("a", {
						href: buildUrl({ strona: String(page - 1) }),
						className: "px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors",
						children: "← Poprzednia"
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "text-gray-500",
						children: [
							"Strona ",
							page,
							" z ",
							totalPages
						]
					}),
					page < totalPages && /* @__PURE__ */ jsx("a", {
						href: buildUrl({ strona: String(page + 1) }),
						className: "px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors",
						children: "Następna →"
					})
				]
			})
		]
	});
});
function formatDate(iso) {
	return (/* @__PURE__ */ new Date(iso + "T12:00:00")).toLocaleDateString("pl-PL", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric"
	});
}
//#endregion
//#region app/routes/admin.uzytkownicy.tsx
var admin_uzytkownicy_exports = /* @__PURE__ */ __exportAll({
	action: () => action$1,
	default: () => admin_uzytkownicy_default,
	loader: () => loader$2
});
async function loader$2({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	if (!canManageUsers(user.role)) throw new Response(null, { status: 403 });
	return {
		currentUser: user,
		users: await queryAll(env.DB, "SELECT id, email, name, role, is_active, on_duty, created_at FROM users ORDER BY name ASC")
	};
}
async function action$1({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const actor = requireUser(await getSessionUser(env.DB, token));
	if (!canManageUsers(actor.role)) throw new Response(null, { status: 403 });
	const form = await request.formData();
	const _action = form.get("_action");
	if (_action === "create") {
		const email = form.get("email")?.trim().toLowerCase();
		const name = form.get("name")?.trim();
		const role = form.get("role");
		if (!email || !name || !role) return data({ error: "Wypełnij wszystkie pola." }, { status: 400 });
		if (!assignableRoles(actor.role).includes(role)) return data({ error: "Brak uprawnień do przypisania tej roli." }, { status: 403 });
		const tempPass = generateToken(6);
		const hash = await hashPassword(tempPass);
		try {
			await execute(env.DB, "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", [
				email,
				name,
				hash,
				role
			]);
		} catch {
			return data({ error: "Adres e-mail jest już zajęty." }, { status: 409 });
		}
		const appUrl = new URL(request.url).origin;
		await sendEmail(env, {
			to: email,
			...tplAccountCreated({
				name,
				tempPassword: tempPass,
				appUrl
			})
		});
		await logAction(env.DB, {
			userId: actor.id,
			action: "user.created",
			entityType: "user",
			details: {
				email,
				role
			}
		});
	} else if (_action === "edit") {
		const userId = parseInt(form.get("user_id"), 10);
		const name = form.get("name")?.trim();
		const role = form.get("role");
		if (!assignableRoles(actor.role).includes(role)) return data({ error: "Brak uprawnień do przypisania tej roli." }, { status: 403 });
		await execute(env.DB, "UPDATE users SET name=?, role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [
			name,
			role,
			userId
		]);
		await logAction(env.DB, {
			userId: actor.id,
			action: "user.edited",
			entityType: "user",
			entityId: userId
		});
	} else if (_action === "toggle_active") {
		const userId = parseInt(form.get("user_id"), 10);
		if (userId === actor.id) return data({ error: "Nie możesz dezaktywować własnego konta." }, { status: 400 });
		await execute(env.DB, "UPDATE users SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?", [userId]);
		await logAction(env.DB, {
			userId: actor.id,
			action: "user.toggled",
			entityType: "user",
			entityId: userId
		});
	} else if (_action === "delete_user") {
		const userId = parseInt(form.get("user_id"), 10);
		if (userId === actor.id) return data({ error: "Nie możesz usunąć własnego konta." }, { status: 400 });
		await logAction(env.DB, {
			userId: actor.id,
			action: "user.deleted",
			entityType: "user",
			entityId: userId
		});
		await execute(env.DB, "UPDATE audit_logs SET user_id = NULL WHERE user_id = ?", [userId]);
		await execute(env.DB, "UPDATE bookings SET created_by_admin_id = NULL WHERE created_by_admin_id = ?", [userId]);
		await execute(env.DB, "DELETE FROM booking_change_requests WHERE requester_id = ?", [userId]);
		await execute(env.DB, "DELETE FROM bookings WHERE requester_id = ?", [userId]);
		await execute(env.DB, "DELETE FROM users WHERE id = ?", [userId]);
	}
	return redirect("/admin/uzytkownicy");
}
var admin_uzytkownicy_default = UNSAFE_withComponentProps(function AdminUzytkownicy({ loaderData, actionData }) {
	const { currentUser, users } = loaderData;
	const pending = useNavigation().state === "submitting";
	const allowedRoles = assignableRoles(currentUser.role);
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-5xl mx-auto px-4 py-8 space-y-8",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: "Użytkownicy"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4",
				children: [
					/* @__PURE__ */ jsxs("h2", {
						className: "font-semibold text-gray-900 flex items-center gap-2",
						children: [/* @__PURE__ */ jsx(Plus, { size: 18 }), " Dodaj użytkownika"]
					}),
					/* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "grid grid-cols-1 sm:grid-cols-4 gap-3",
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "create"
							}),
							/* @__PURE__ */ jsx("input", {
								name: "name",
								type: "text",
								placeholder: "Imię i nazwisko",
								required: true,
								className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							}),
							/* @__PURE__ */ jsx("input", {
								name: "email",
								type: "email",
								placeholder: "Adres e-mail",
								required: true,
								className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							}),
							/* @__PURE__ */ jsxs("select", {
								name: "role",
								required: true,
								className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
								children: [/* @__PURE__ */ jsx("option", {
									value: "",
									children: "— rola —"
								}), allowedRoles.map((r) => /* @__PURE__ */ jsx("option", {
									value: r,
									children: ROLE_LABELS[r]
								}, r))]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: pending,
								className: "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg",
								children: "Dodaj"
							})
						]
					}),
					actionData?.error && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
						children: actionData.error
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "bg-gray-50 border-b border-gray-200",
						children: /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Imię i nazwisko"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "E-mail"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Rola"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Status"
							}),
							/* @__PURE__ */ jsx("th", { className: "px-4 py-3" })
						] })
					}), /* @__PURE__ */ jsx("tbody", {
						className: "divide-y divide-gray-100",
						children: users.map((u) => /* @__PURE__ */ jsx(UserRow, {
							u,
							currentUser,
							allowedRoles,
							pending
						}, u.id))
					})]
				})
			})
		]
	});
});
function UserRow({ u, currentUser, allowedRoles, pending }) {
	const isSelf = u.id === currentUser.id;
	return /* @__PURE__ */ jsxs("tr", {
		className: u.is_active ? "" : "opacity-50",
		children: [
			/* @__PURE__ */ jsx("td", {
				className: "px-4 py-3 font-medium text-gray-900",
				children: u.name
			}),
			/* @__PURE__ */ jsx("td", {
				className: "px-4 py-3 text-gray-500",
				children: u.email
			}),
			/* @__PURE__ */ jsx("td", {
				className: "px-4 py-3",
				children: /* @__PURE__ */ jsxs(Form, {
					method: "post",
					className: "inline-flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("input", {
							type: "hidden",
							name: "_action",
							value: "edit"
						}),
						/* @__PURE__ */ jsx("input", {
							type: "hidden",
							name: "user_id",
							value: u.id
						}),
						/* @__PURE__ */ jsx("input", {
							type: "hidden",
							name: "name",
							value: u.name
						}),
						/* @__PURE__ */ jsx("select", {
							name: "role",
							defaultValue: u.role,
							onChange: (e) => e.currentTarget.form.submit(),
							className: "border border-gray-200 rounded-lg px-2 py-1 text-xs bg-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none",
							children: allowedRoles.includes(u.role) || currentUser.role === "super_admin" ? [...new Set([...allowedRoles, u.role])].map((r) => /* @__PURE__ */ jsx("option", {
								value: r,
								disabled: !allowedRoles.includes(r),
								children: ROLE_LABELS[r]
							}, r)) : /* @__PURE__ */ jsx("option", {
								value: u.role,
								children: ROLE_LABELS[u.role]
							})
						})
					]
				})
			}),
			/* @__PURE__ */ jsx("td", {
				className: "px-4 py-3",
				children: /* @__PURE__ */ jsx("span", {
					className: `text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`,
					children: u.is_active ? "Aktywny" : "Nieaktywny"
				})
			}),
			/* @__PURE__ */ jsx("td", {
				className: "px-4 py-3 text-right",
				children: /* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-end gap-3",
					children: [!isSelf && /* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "inline",
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "toggle_active"
							}),
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "user_id",
								value: u.id
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: pending,
								title: u.is_active ? "Dezaktywuj" : "Aktywuj",
								className: "text-gray-400 hover:text-gray-700 transition-colors",
								children: u.is_active ? /* @__PURE__ */ jsx(ToggleRight, {
									size: 18,
									className: "text-green-500"
								}) : /* @__PURE__ */ jsx(ToggleLeft, { size: 18 })
							})
						]
					}), !isSelf && /* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "inline",
						onSubmit: (e) => {
							if (!window.confirm(`Usunąć użytkownika ${u.name}? Operacja jest nieodwracalna.`)) e.preventDefault();
						},
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "delete_user"
							}),
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "user_id",
								value: u.id
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: pending,
								title: "Usuń użytkownika",
								className: "text-gray-300 hover:text-red-500 transition-colors",
								children: /* @__PURE__ */ jsx(Trash2, { size: 16 })
							})
						]
					})]
				})
			})
		]
	});
}
//#endregion
//#region app/routes/admin.sale.tsx
var admin_sale_exports = /* @__PURE__ */ __exportAll({
	action: () => action,
	default: () => admin_sale_default,
	loader: () => loader$1
});
async function loader$1({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (!canManageRooms(requireUser(await getSessionUser(env.DB, token)).role)) throw new Response(null, { status: 403 });
	return { rooms: await queryAll(env.DB, "SELECT * FROM rooms ORDER BY sort_order ASC") };
}
async function action({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	const user = requireUser(await getSessionUser(env.DB, token));
	if (!canManageRooms(user.role)) throw new Response(null, { status: 403 });
	const form = await request.formData();
	const _action = form.get("_action");
	if (_action === "create") {
		const name = form.get("name")?.trim();
		const sizeLabel = form.get("size_label")?.trim() || null;
		const category = form.get("category");
		const sortOrder = parseInt(form.get("sort_order") || "0", 10);
		if (!name || !category) return data({ error: "Nazwa i kategoria są wymagane." }, { status: 400 });
		await execute(env.DB, "INSERT INTO rooms (name, size_label, category, sort_order) VALUES (?, ?, ?, ?)", [
			name,
			sizeLabel,
			category,
			sortOrder
		]);
		await logAction(env.DB, {
			userId: user.id,
			action: "room.created",
			entityType: "room",
			details: {
				name,
				category
			}
		});
	} else if (_action === "edit") {
		const roomId = parseInt(form.get("room_id"), 10);
		const name = form.get("name")?.trim();
		const sizeLabel = form.get("size_label")?.trim() || null;
		const category = form.get("category");
		const sortOrder = parseInt(form.get("sort_order") || "0", 10);
		await execute(env.DB, "UPDATE rooms SET name=?, size_label=?, category=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [
			name,
			sizeLabel,
			category,
			sortOrder,
			roomId
		]);
		await logAction(env.DB, {
			userId: user.id,
			action: "room.edited",
			entityType: "room",
			entityId: roomId
		});
	} else if (_action === "toggle_active") {
		const roomId = parseInt(form.get("room_id"), 10);
		await execute(env.DB, "UPDATE rooms SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?", [roomId]);
		await logAction(env.DB, {
			userId: user.id,
			action: "room.toggled",
			entityType: "room",
			entityId: roomId
		});
	}
	return redirect("/admin/sale");
}
var admin_sale_default = UNSAFE_withComponentProps(function AdminSale({ loaderData, actionData }) {
	const { rooms } = loaderData;
	const pending = useNavigation().state === "submitting";
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-4xl mx-auto px-4 py-8 space-y-8",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: "Zarządzanie salami"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4",
				children: [
					/* @__PURE__ */ jsxs("h2", {
						className: "font-semibold text-gray-900 flex items-center gap-2",
						children: [/* @__PURE__ */ jsx(Plus, { size: 18 }), " Dodaj salę"]
					}),
					/* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "grid grid-cols-1 sm:grid-cols-5 gap-3",
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "create"
							}),
							/* @__PURE__ */ jsx("input", {
								name: "name",
								type: "text",
								placeholder: "Nazwa sali",
								required: true,
								className: "sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							}),
							/* @__PURE__ */ jsx("input", {
								name: "size_label",
								type: "text",
								placeholder: "Pojemność (np. 4–8 osób)",
								className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							}),
							/* @__PURE__ */ jsxs("select", {
								name: "category",
								required: true,
								className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "",
										children: "— kategoria —"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "general",
										children: "Ogólna"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "board",
										children: "Zarząd"
									})
								]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: pending,
								className: "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg",
								children: "Dodaj"
							})
						]
					}),
					actionData?.error && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2",
						children: actionData.error
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "space-y-3",
				children: rooms.map((room) => /* @__PURE__ */ jsxs("div", {
					className: `bg-white border border-gray-200 rounded-xl p-5 shadow-sm ${!room.is_active ? "opacity-60" : ""}`,
					children: [/* @__PURE__ */ jsxs(Form, {
						method: "post",
						className: "grid grid-cols-1 sm:grid-cols-6 gap-3 items-end",
						children: [
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "_action",
								value: "edit"
							}),
							/* @__PURE__ */ jsx("input", {
								type: "hidden",
								name: "room_id",
								value: room.id
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ jsx("label", {
									className: "block text-xs font-medium text-gray-500 mb-1",
									children: "Nazwa"
								}), /* @__PURE__ */ jsx("input", {
									name: "name",
									type: "text",
									defaultValue: room.name,
									required: true,
									className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
								})]
							}),
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								className: "block text-xs font-medium text-gray-500 mb-1",
								children: "Pojemność"
							}), /* @__PURE__ */ jsx("input", {
								name: "size_label",
								type: "text",
								defaultValue: room.size_label ?? "",
								className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							})] }),
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								className: "block text-xs font-medium text-gray-500 mb-1",
								children: "Kategoria"
							}), /* @__PURE__ */ jsxs("select", {
								name: "category",
								defaultValue: room.category,
								className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
								children: [/* @__PURE__ */ jsx("option", {
									value: "general",
									children: "Ogólna"
								}), /* @__PURE__ */ jsx("option", {
									value: "board",
									children: "Zarząd"
								})]
							})] }),
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								className: "block text-xs font-medium text-gray-500 mb-1",
								children: "Kolejność"
							}), /* @__PURE__ */ jsx("input", {
								name: "sort_order",
								type: "number",
								defaultValue: room.sort_order,
								className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							})] }),
							/* @__PURE__ */ jsx("div", {
								className: "flex gap-2",
								children: /* @__PURE__ */ jsx("button", {
									type: "submit",
									disabled: pending,
									className: "flex-1 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg",
									children: "Zapisz"
								})
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between mt-3 pt-3 border-t border-gray-100",
						children: [/* @__PURE__ */ jsx("span", {
							className: `text-xs px-2 py-0.5 rounded-full ${room.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`,
							children: room.is_active ? "Aktywna" : "Nieaktywna"
						}), /* @__PURE__ */ jsxs(Form, {
							method: "post",
							children: [
								/* @__PURE__ */ jsx("input", {
									type: "hidden",
									name: "_action",
									value: "toggle_active"
								}),
								/* @__PURE__ */ jsx("input", {
									type: "hidden",
									name: "room_id",
									value: room.id
								}),
								/* @__PURE__ */ jsx("button", {
									type: "submit",
									disabled: pending,
									className: "text-xs text-gray-500 hover:text-gray-800 underline",
									children: room.is_active ? "Dezaktywuj" : "Aktywuj"
								})
							]
						})]
					})]
				}, room.id))
			})
		]
	});
});
//#endregion
//#region app/routes/admin.logi.tsx
var admin_logi_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_logi_default,
	loader: () => loader
});
async function loader({ request, context }) {
	const { env } = context.cloudflare;
	const token = getTokenFromRequest(request);
	if (!canViewAuditLogs(requireUser(await getSessionUser(env.DB, token)).role)) throw new Response(null, { status: 403 });
	const url = new URL(request.url);
	const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));
	const limit = 50;
	const offset = (page - 1) * limit;
	return {
		logs: await queryAll(env.DB, `SELECT al.*, u.name as user_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id=al.user_id
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`, [limit, offset]),
		page,
		total: (await queryAll(env.DB, "SELECT COUNT(*) as n FROM audit_logs", []))[0]?.n ?? 0,
		limit
	};
}
var ACTION_LABELS = {
	"booking.requested": "Złożono wniosek",
	"booking.direct_created": "Bezpośrednia rezerwacja",
	"booking.approved": "Zatwierdzono rezerwację",
	"booking.rejected": "Odrzucono rezerwację",
	"booking.counter_proposed": "Kontrpropozycja",
	"booking.counter_accepted": "Zaakceptowano kontrpropozycję",
	"booking.counter_rejected": "Odrzucono kontrpropozycję",
	"booking.edited": "Edytowano wniosek",
	"change_request.submitted": "Złożono wniosek o zmianę",
	"change_request.approved": "Zatwierdzono zmianę",
	"change_request.rejected": "Odrzucono zmianę",
	"user.created": "Utworzono użytkownika",
	"user.edited": "Edytowano użytkownika",
	"user.toggled": "Zmieniono status użytkownika",
	"room.created": "Dodano salę",
	"room.edited": "Edytowano salę",
	"room.toggled": "Zmieniono status sali"
};
var admin_logi_default = UNSAFE_withComponentProps(function AdminLogi({ loaderData }) {
	const { logs, page, total, limit } = loaderData;
	const totalPages = Math.ceil(total / limit);
	return /* @__PURE__ */ jsxs("div", {
		className: "max-w-5xl mx-auto px-4 py-8 space-y-6",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-bold text-gray-900",
				children: "Logi audytu"
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "text-sm text-gray-500",
				children: [total, " wpisów łącznie"]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "bg-gray-50 border-b border-gray-200",
						children: /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Data"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Użytkownik"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Akcja"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "text-left px-4 py-3 font-medium text-gray-600",
								children: "Obiekt"
							})
						] })
					}), /* @__PURE__ */ jsx("tbody", {
						className: "divide-y divide-gray-100",
						children: logs.map((log) => /* @__PURE__ */ jsxs("tr", {
							className: "hover:bg-gray-50",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-gray-500 whitespace-nowrap text-xs",
									children: log.created_at.replace("T", " ").slice(0, 16)
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-gray-700",
									children: log.user_name ?? /* @__PURE__ */ jsx("span", {
										className: "text-gray-400",
										children: "—"
									})
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-gray-900 font-medium",
									children: ACTION_LABELS[log.action] ?? log.action
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3 text-gray-500",
									children: [log.entity_type, log.entity_id ? ` #${log.entity_id}` : ""]
								})
							]
						}, log.id))
					})]
				})
			}),
			totalPages > 1 && /* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2 text-sm",
				children: [
					page > 1 && /* @__PURE__ */ jsx("a", {
						href: `?strona=${page - 1}`,
						className: "px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50",
						children: "← Poprzednia"
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "text-gray-500",
						children: [
							"Strona ",
							page,
							" z ",
							totalPages
						]
					}),
					page < totalPages && /* @__PURE__ */ jsx("a", {
						href: `?strona=${page + 1}`,
						className: "px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50",
						children: "Następna →"
					})
				]
			})
		]
	});
});
//#endregion
//#region \0virtual:react-router/server-manifest
var server_manifest_default = {
	"entry": {
		"module": "/assets/entry.client-Dsa0uCEg.js",
		"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
		"css": []
	},
	"routes": {
		"root": {
			"id": "root",
			"parentId": void 0,
			"path": "",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": true,
			"module": "/assets/root-CbVkLAqn.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": ["/assets/root-BDnaIfK7.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/login": {
			"id": "routes/login",
			"parentId": "root",
			"path": "login",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/login-DvGpL2A4.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/logout": {
			"id": "routes/logout",
			"parentId": "root",
			"path": "logout",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/logout-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/_app": {
			"id": "routes/_app",
			"parentId": "root",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/_app-CeplIA2N.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/types-OzD2FwaS.js",
				"/assets/createLucideIcon-BwI5l6wY.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/dashboard": {
			"id": "routes/dashboard",
			"parentId": "routes/_app",
			"path": void 0,
			"index": true,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/dashboard-QGKCsQha.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/types-OzD2FwaS.js",
				"/assets/createLucideIcon-BwI5l6wY.js",
				"/assets/plus-Dttq1pHH.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/rezerwacje.nowa": {
			"id": "routes/rezerwacje.nowa",
			"parentId": "routes/_app",
			"path": "rezerwacje/nowa",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/rezerwacje.nowa-D_vfgkDL.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/rezerwacje.$id": {
			"id": "routes/rezerwacje.$id",
			"parentId": "routes/_app",
			"path": "rezerwacje/:id",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/rezerwacje._id-C2T8Hct8.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/types-OzD2FwaS.js",
				"/assets/createLucideIcon-BwI5l6wY.js",
				"/assets/refresh-cw-LCayBJVs.js",
				"/assets/trash-2-C-4LfIIA.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/rezerwacje.$id.edytuj": {
			"id": "routes/rezerwacje.$id.edytuj",
			"parentId": "routes/_app",
			"path": "rezerwacje/:id/edytuj",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/rezerwacje._id.edytuj-zOEY5pwb.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/rezerwacje.$id.zmiana": {
			"id": "routes/rezerwacje.$id.zmiana",
			"parentId": "routes/_app",
			"path": "rezerwacje/:id/zmiana",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/rezerwacje._id.zmiana-FJmweUdN.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/ustawienia": {
			"id": "routes/ustawienia",
			"parentId": "routes/_app",
			"path": "ustawienia",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/ustawienia-BeABfB9B.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin.rezerwacje": {
			"id": "routes/admin.rezerwacje",
			"parentId": "routes/_app",
			"path": "admin/rezerwacje",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin.rezerwacje-wNQ7y9np.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/refresh-cw-LCayBJVs.js",
				"/assets/createLucideIcon-BwI5l6wY.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin.panel": {
			"id": "routes/admin.panel",
			"parentId": "routes/_app",
			"path": "admin/panel",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin.panel-BVUpGJ2K.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js", "/assets/types-OzD2FwaS.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin.uzytkownicy": {
			"id": "routes/admin.uzytkownicy",
			"parentId": "routes/_app",
			"path": "admin/uzytkownicy",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin.uzytkownicy-C1KfjiM5.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/types-OzD2FwaS.js",
				"/assets/createLucideIcon-BwI5l6wY.js",
				"/assets/plus-Dttq1pHH.js",
				"/assets/trash-2-C-4LfIIA.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin.sale": {
			"id": "routes/admin.sale",
			"parentId": "routes/_app",
			"path": "admin/sale",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin.sale-BcBdoX0b.js",
			"imports": [
				"/assets/jsx-runtime-1fArcI6m.js",
				"/assets/plus-Dttq1pHH.js",
				"/assets/createLucideIcon-BwI5l6wY.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin.logi": {
			"id": "routes/admin.logi",
			"parentId": "routes/_app",
			"path": "admin/logi",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin.logi-B1kFY-JP.js",
			"imports": ["/assets/jsx-runtime-1fArcI6m.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-f9d6d439.js",
	"version": "f9d6d439",
	"sri": void 0
};
//#endregion
//#region \0virtual:react-router/server-build
var assetsBuildDirectory = "build/client";
var basename = "/";
var future = {
	"unstable_optimizeDeps": false,
	"v8_passThroughRequests": false,
	"v8_trailingSlashAwareDataRequests": true,
	"unstable_previewServerPrerendering": false,
	"v8_middleware": false,
	"v8_splitRouteModules": true,
	"v8_viteEnvironmentApi": false
};
var ssr = true;
var isSpaMode = false;
var prerender = [];
var routeDiscovery = {
	"mode": "lazy",
	"manifestPath": "/__manifest"
};
var publicPath = "/";
var entry = { module: entry_server_exports };
var routes = {
	"root": {
		id: "root",
		parentId: void 0,
		path: "",
		index: void 0,
		caseSensitive: void 0,
		module: root_exports
	},
	"routes/login": {
		id: "routes/login",
		parentId: "root",
		path: "login",
		index: void 0,
		caseSensitive: void 0,
		module: login_exports
	},
	"routes/logout": {
		id: "routes/logout",
		parentId: "root",
		path: "logout",
		index: void 0,
		caseSensitive: void 0,
		module: logout_exports
	},
	"routes/_app": {
		id: "routes/_app",
		parentId: "root",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: _app_exports
	},
	"routes/dashboard": {
		id: "routes/dashboard",
		parentId: "routes/_app",
		path: void 0,
		index: true,
		caseSensitive: void 0,
		module: dashboard_exports
	},
	"routes/rezerwacje.nowa": {
		id: "routes/rezerwacje.nowa",
		parentId: "routes/_app",
		path: "rezerwacje/nowa",
		index: void 0,
		caseSensitive: void 0,
		module: rezerwacje_nowa_exports
	},
	"routes/rezerwacje.$id": {
		id: "routes/rezerwacje.$id",
		parentId: "routes/_app",
		path: "rezerwacje/:id",
		index: void 0,
		caseSensitive: void 0,
		module: rezerwacje_$id_exports
	},
	"routes/rezerwacje.$id.edytuj": {
		id: "routes/rezerwacje.$id.edytuj",
		parentId: "routes/_app",
		path: "rezerwacje/:id/edytuj",
		index: void 0,
		caseSensitive: void 0,
		module: rezerwacje_$id_edytuj_exports
	},
	"routes/rezerwacje.$id.zmiana": {
		id: "routes/rezerwacje.$id.zmiana",
		parentId: "routes/_app",
		path: "rezerwacje/:id/zmiana",
		index: void 0,
		caseSensitive: void 0,
		module: rezerwacje_$id_zmiana_exports
	},
	"routes/ustawienia": {
		id: "routes/ustawienia",
		parentId: "routes/_app",
		path: "ustawienia",
		index: void 0,
		caseSensitive: void 0,
		module: ustawienia_exports
	},
	"routes/admin.rezerwacje": {
		id: "routes/admin.rezerwacje",
		parentId: "routes/_app",
		path: "admin/rezerwacje",
		index: void 0,
		caseSensitive: void 0,
		module: admin_rezerwacje_exports
	},
	"routes/admin.panel": {
		id: "routes/admin.panel",
		parentId: "routes/_app",
		path: "admin/panel",
		index: void 0,
		caseSensitive: void 0,
		module: admin_panel_exports
	},
	"routes/admin.uzytkownicy": {
		id: "routes/admin.uzytkownicy",
		parentId: "routes/_app",
		path: "admin/uzytkownicy",
		index: void 0,
		caseSensitive: void 0,
		module: admin_uzytkownicy_exports
	},
	"routes/admin.sale": {
		id: "routes/admin.sale",
		parentId: "routes/_app",
		path: "admin/sale",
		index: void 0,
		caseSensitive: void 0,
		module: admin_sale_exports
	},
	"routes/admin.logi": {
		id: "routes/admin.logi",
		parentId: "routes/_app",
		path: "admin/logi",
		index: void 0,
		caseSensitive: void 0,
		module: admin_logi_exports
	}
};
var allowedActionOrigins = false;
//#endregion
export { allowedActionOrigins, server_manifest_default as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
