import { redirect, data, Form, useNavigation, useFetcher } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/admin.uzytkownicy";
import { getTokenFromRequest, getSessionUser, requireUser, hashPassword } from "~/lib/auth.server";
import { queryAll, queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canManageUsers, assignableRoles, ROLE_LABELS } from "~/types";
import type { User } from "~/types";
import { Plus, ToggleLeft, ToggleRight, Trash2, Copy, Check, X, KeyRound, Pencil, Shield, Search } from "lucide-react";
import { ConfirmModal } from "~/components/ConfirmModal";

function tempPasswordFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const prefix = first.slice(0, 3);
  const formatted = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
  const suffix = last.slice(-3).toLowerCase();
  return `${formatted}${suffix}098^`;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageUsers(user.role)) throw new Response(null, { status: 403 });

  const users = await queryAll<User>(
    env.DB,
    "SELECT id, email, name, role, is_active, on_duty, created_at, admin_can_assign_admin, admin_can_assign_zarzad, admin_can_assign_pracownik, admin_can_manage_rooms FROM users ORDER BY name ASC"
  );
  return { currentUser: user, users };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const actor = requireUser(await getSessionUser(env.DB, token));
  if (!canManageUsers(actor.role)) throw new Response(null, { status: 403 });

  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const email = (form.get("email") as string)?.trim().toLowerCase();
    const name = (form.get("name") as string)?.trim();
    const role = form.get("role") as User['role'];

    if (!email || !name || !role) return data({ error: "Wypełnij wszystkie pola." }, { status: 400 });
    const allowed = assignableRoles(actor);
    if (!allowed.includes(role)) return data({ error: "Brak uprawnień do przypisania tej roli." }, { status: 403 });

    const tempPass = tempPasswordFromName(name);
    const hash = await hashPassword(tempPass);

    // Only a super_admin creating an admin gets to set these delegation
    // flags explicitly; every other combination (including an admin creating
    // another admin) defaults to no delegated permissions at all, rather than
    // silently inheriting elevated defaults.
    const isSuperAdminCreatingAdmin = actor.role === 'super_admin' && role === 'admin';
    const canAssignAdmin     = isSuperAdminCreatingAdmin ? (form.get("admin_can_assign_admin")     === "1" ? 1 : 0) : 0;
    const canAssignZarzad    = isSuperAdminCreatingAdmin ? (form.get("admin_can_assign_zarzad")    === "1" ? 1 : 0) : 0;
    const canAssignPracownik = isSuperAdminCreatingAdmin ? (form.get("admin_can_assign_pracownik") === "1" ? 1 : 0) : 0;
    const canManageRoomsVal  = isSuperAdminCreatingAdmin ? (form.get("admin_can_manage_rooms")     === "1" ? 1 : 0) : 0;

    try {
      await execute(
        env.DB,
        "INSERT INTO users (email, name, password_hash, role, admin_can_assign_admin, admin_can_assign_zarzad, admin_can_assign_pracownik, admin_can_manage_rooms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [email, name, hash, role, canAssignAdmin, canAssignZarzad, canAssignPracownik, canManageRoomsVal]
      );
    } catch {
      return data({ error: "Adres e-mail jest już zajęty." }, { status: 409 });
    }

    await logAction(env.DB, { userId: actor.id, action: 'user.created', entityType: 'user', details: { email, role } });
    return data({ created: { name, email, tempPassword: tempPass, reason: 'created' as const } });
  }

  else if (_action === "edit") {
    const userId = parseInt(form.get("user_id") as string, 10);
    const name = (form.get("name") as string)?.trim();
    const role = form.get("role") as User['role'];
    const allowed = assignableRoles(actor);
    if (!allowed.includes(role)) return data({ error: "Brak uprawnień do przypisania tej roli." }, { status: 403 });
    const editTarget = await queryOne<{ role: string }>(env.DB, "SELECT role FROM users WHERE id=?", [userId]);
    if (editTarget?.role === 'super_admin' && actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień do modyfikacji konta Super Admin." }, { status: 403 });
    await execute(env.DB, "UPDATE users SET name=?, role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [name, role, userId]);
    await logAction(env.DB, { userId: actor.id, action: 'user.edited', entityType: 'user', entityId: userId });
  }

  else if (_action === "edit_profile") {
    const userId = parseInt(form.get("user_id") as string, 10);
    const name = (form.get("name") as string)?.trim();
    const email = (form.get("email") as string)?.trim().toLowerCase();
    if (!name || !email) return data({ error: "Imię i adres e-mail są wymagane." }, { status: 400 });
    const profileTarget = await queryOne<{ role: string }>(env.DB, "SELECT role FROM users WHERE id=?", [userId]);
    if (profileTarget?.role === 'super_admin' && actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień do modyfikacji konta Super Admin." }, { status: 403 });
    try {
      await execute(env.DB, "UPDATE users SET name=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [name, email, userId]);
    } catch {
      return data({ error: "Adres e-mail jest już zajęty." }, { status: 409 });
    }
    await logAction(env.DB, { userId: actor.id, action: 'user.profile_edited', entityType: 'user', entityId: userId });
    return data({ success: true });
  }

  else if (_action === "toggle_active") {
    const userId = parseInt(form.get("user_id") as string, 10);
    if (userId === actor.id) return data({ error: "Nie możesz dezaktywować własnego konta." }, { status: 400 });
    const toggleTarget = await queryOne<{ role: string }>(env.DB, "SELECT role FROM users WHERE id=?", [userId]);
    if (toggleTarget?.role === 'super_admin' && actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień do modyfikacji konta Super Admin." }, { status: 403 });
    await execute(
      env.DB,
      "UPDATE users SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [userId]
    );
    await logAction(env.DB, { userId: actor.id, action: 'user.toggled', entityType: 'user', entityId: userId });
  }

  else if (_action === "reset_password") {
    const userId = parseInt(form.get("user_id") as string, 10);
    if (userId === actor.id) return data({ error: "Nie możesz resetować własnego hasła tą metodą." }, { status: 400 });
    const target = await queryOne<User>(env.DB, "SELECT * FROM users WHERE id=?", [userId]);
    if (!target) return data({ error: "Nie znaleziono użytkownika." }, { status: 404 });
    if (target.role === 'super_admin' && actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień do modyfikacji konta Super Admin." }, { status: 403 });
    const tempPass = tempPasswordFromName(target.name);
    const hash = await hashPassword(tempPass);
    await execute(env.DB, "UPDATE users SET password_hash=?, must_change_password=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", [hash, userId]);
    await logAction(env.DB, { userId: actor.id, action: 'user.password_reset', entityType: 'user', entityId: userId });
    return data({ created: { name: target.name, email: target.email, tempPassword: tempPass, reason: 'reset' as const } });
  }

  else if (_action === "delete_user") {
    const userId = parseInt(form.get("user_id") as string, 10);
    if (userId === actor.id) return data({ error: "Nie możesz usunąć własnego konta." }, { status: 400 });
    const deleteTarget = await queryOne<{ role: string }>(env.DB, "SELECT role FROM users WHERE id=?", [userId]);
    if (deleteTarget?.role === 'super_admin' && actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień do usunięcia konta Super Admin." }, { status: 403 });

    // Log before deletion while the row still exists
    await logAction(env.DB, { userId: actor.id, action: 'user.deleted', entityType: 'user', entityId: userId });

    // Nullify nullable FK references so history is preserved
    await execute(env.DB, "UPDATE audit_logs SET user_id = NULL WHERE user_id = ?", [userId]);
    await execute(env.DB, "UPDATE bookings SET created_by_admin_id = NULL WHERE created_by_admin_id = ?", [userId]);

    // Remove change requests submitted by this user on other people's bookings
    await execute(env.DB, "DELETE FROM booking_change_requests WHERE requester_id = ?", [userId]);

    // Remove user's own bookings (ON DELETE CASCADE cleans up their change_requests)
    await execute(env.DB, "DELETE FROM bookings WHERE requester_id = ?", [userId]);

    // Delete user — sessions cascade via ON DELETE CASCADE
    await execute(env.DB, "DELETE FROM users WHERE id = ?", [userId]);
  }

  else if (_action === "set_admin_permissions") {
    if (actor.role !== 'super_admin')
      return data({ error: "Brak uprawnień." }, { status: 403 });
    const userId = parseInt(form.get("user_id") as string, 10);
    const permTarget = await queryOne<{ role: string }>(env.DB, "SELECT role FROM users WHERE id=?", [userId]);
    if (permTarget?.role !== 'admin')
      return data({ error: "Uprawnienia można konfigurować tylko dla administratorów." }, { status: 400 });
    const canAssignAdmin    = form.get("admin_can_assign_admin")    === "1" ? 1 : 0;
    const canAssignZarzad   = form.get("admin_can_assign_zarzad")   === "1" ? 1 : 0;
    const canAssignPracownik= form.get("admin_can_assign_pracownik")=== "1" ? 1 : 0;
    const canManageRoomsVal = form.get("admin_can_manage_rooms")    === "1" ? 1 : 0;
    await execute(
      env.DB,
      "UPDATE users SET admin_can_assign_admin=?, admin_can_assign_zarzad=?, admin_can_assign_pracownik=?, admin_can_manage_rooms=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [canAssignAdmin, canAssignZarzad, canAssignPracownik, canManageRoomsVal, userId]
    );
    await logAction(env.DB, { userId: actor.id, action: 'user.edited', entityType: 'user', entityId: userId, details: { admin_permissions: { canAssignAdmin, canAssignZarzad, canAssignPracownik, canManageRoomsVal } } });
    return data({ success: true });
  }

  return redirect("/admin/uzytkownicy");
}

export default function AdminUzytkownicy({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser, users } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const allowedRoles = assignableRoles(currentUser);
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const autoCopyRef = useRef(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('pracownik');
  const [newPermAssignAdmin, setNewPermAssignAdmin] = useState(true);
  const [newPermAssignZarzad, setNewPermAssignZarzad] = useState(false);
  const [newPermAssignPracownik, setNewPermAssignPracownik] = useState(true);
  const [newPermManageRooms, setNewPermManageRooms] = useState(false);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filteredUsers = users.filter(u => {
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    if (filterRole && u.role !== filterRole) return false;
    if (filterStatus === 'active' && !u.is_active) return false;
    if (filterStatus === 'inactive' && u.is_active) return false;
    return true;
  });

  function handleNewEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewEmail(val);
    const match = val.match(/^(.+)@lafrentz\.pl$/i);
    if (match) {
      const parsed = match[1]
        .split('.')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
      setNewName(parsed);
    }
  }

  const created = actionData && 'created' in actionData ? actionData.created : null;
  const showBanner = !!created && !bannerDismissed;

  function buildMessage(c: NonNullable<typeof created>) {
    if (c.reason === 'reset') {
      return `Twoje hasło do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało zresetowane.\nDane do logowania:\nAdres e-mail: ${c.email}\nNowe hasło tymczasowe: ${c.tempPassword}\n\nPo zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli masz problem z logowaniem, skontaktuj się z recepcją.`;
    }
    return `Twoje konto do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało utworzone.\nDane do pierwszego logowania:\nAdres e-mail: ${c.email}\nHasło: ${c.tempPassword}\n\nPo pierwszym zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli zapomnisz swoje hasło, skontaktuj się z recepcją.`;
  }

  useEffect(() => {
    if (created) {
      setBannerDismissed(false);
      setNewEmail('');
      setNewName('');
      setNewRole('pracownik');
      setNewPermAssignAdmin(true);
      setNewPermAssignZarzad(false);
      setNewPermAssignPracownik(true);
      setNewPermManageRooms(false);
    }
  }, [created?.email]);

  useEffect(() => {
    if (!created || !autoCopyRef.current) return;
    autoCopyRef.current = false;
    navigator.clipboard.writeText(buildMessage(created)).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created?.tempPassword]);

  function copyPassword() {
    if (!created) return;
    navigator.clipboard.writeText(created.tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyMessage() {
    if (!created) return;
    navigator.clipboard.writeText(buildMessage(created)).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Użytkownicy</h1>

      {/* Account created banner */}
      {showBanner && created && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-green-900">
                {created.reason === 'reset' ? 'Hasło zresetowane' : 'Konto utworzone'} — {created.name} ({created.email})
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-800">Hasło tymczasowe:</span>
                <code className="bg-green-100 border border-green-300 text-green-900 px-2 py-0.5 rounded text-sm font-mono tracking-wider">
                  {created.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="text-green-700 hover:text-green-900 transition-colors"
                  title="Kopiuj hasło"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={copyMessage}
                className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 border border-green-300 bg-green-100 hover:bg-green-200 rounded-lg px-3 py-1.5 transition-colors mt-1"
              >
                {copiedMsg ? <Check size={13} /> : <Copy size={13} />}
                {copiedMsg ? 'Skopiowano!' : 'Kopiuj wiadomość z tymczasowymi danymi logowania'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-green-500 hover:text-green-800 shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add user form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Plus size={18} /> Dodaj użytkownika</h2>
        <Form method="post" className="space-y-3" onSubmit={() => setBannerDismissed(true)}>
          <input type="hidden" name="_action" value="create" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              name="email" type="email" placeholder="Adres e-mail" required
              value={newEmail} onChange={handleNewEmailChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <input
              name="name" type="text" placeholder="Imię i nazwisko" required
              value={newName} onChange={e => setNewName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <select
              name="role" required
              value={newRole} onChange={e => setNewRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {allowedRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Dodaj
            </button>
          </div>
          {currentUser.role === 'super_admin' && newRole === 'admin' && (
            <div className="border border-blue-100 bg-blue-50 rounded-lg px-4 py-3 space-y-2">
              <span className="text-xs font-medium text-blue-700 flex items-center gap-1.5"><Shield size={13} /> Uprawnienia administratora</span>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_admin" value="1"
                    checked={newPermAssignAdmin} onChange={e => setNewPermAssignAdmin(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć administratorów
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_zarzad" value="1"
                    checked={newPermAssignZarzad} onChange={e => setNewPermAssignZarzad(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć Zarząd
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_pracownik" value="1"
                    checked={newPermAssignPracownik} onChange={e => setNewPermAssignPracownik(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć Biuro
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_manage_rooms" value="1"
                    checked={newPermManageRooms} onChange={e => setNewPermManageRooms(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może zarządzać salami
                </label>
              </div>
            </div>
          )}
        </Form>
        {actionData && 'error' in actionData && actionData.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Szukaj po nazwie lub e-mailu…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          >
            <option value="">Wszystkie role</option>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <option key={role} value={role}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          >
            <option value="">Wszyscy</option>
            <option value="active">Aktywni</option>
            <option value="inactive">Nieaktywni</option>
          </select>
          {(filterSearch || filterRole || filterStatus) && (
            <button
              type="button"
              onClick={() => { setFilterSearch(''); setFilterRole(''); setFilterStatus(''); }}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              <X size={12} /> Wyczyść
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filteredUsers.length} z {users.length}</span>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Pencil size={12} /> Edytuj</span>
          <span className="flex items-center gap-1"><Shield size={12} /> Uprawnienia</span>
          <span className="flex items-center gap-1"><Copy size={12} /> Kopiuj wiadomość z tymczasowymi danymi logowania</span>
          <span className="flex items-center gap-1"><KeyRound size={12} /> Resetuj hasło</span>
          <span className="flex items-center gap-1"><ToggleLeft size={14} /><ToggleRight size={14} /> Aktywuj / Dezaktywuj</span>
          <span className="flex items-center gap-1"><Trash2 size={12} /> Usuń</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Imię i nazwisko</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">E-mail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rola</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Brak użytkowników spełniających kryteria filtrowania.</td>
              </tr>
            ) : filteredUsers.map(u => (
              <UserRow key={u.id} u={u} currentUser={currentUser} allowedRoles={allowedRoles} pending={pending} onRequestConfirm={setConfirm} />
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function UserRow({ u, currentUser, allowedRoles, pending, onRequestConfirm }: {
  u: User; currentUser: User; allowedRoles: User['role'][]; pending: boolean;
  onRequestConfirm: (state: { message: string; onConfirm: () => void }) => void;
}) {
  const isSelf = u.id === currentUser.id;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(u.name);
  const [editEmail, setEditEmail] = useState(u.email);
  const [permEditing, setPermEditing] = useState(false);
  const [permAssignAdmin, setPermAssignAdmin] = useState(!!u.admin_can_assign_admin);
  const [permAssignZarzad, setPermAssignZarzad] = useState(!!u.admin_can_assign_zarzad);
  const [permAssignPracownik, setPermAssignPracownik] = useState(!!u.admin_can_assign_pracownik);
  const [permManageRooms, setPermManageRooms] = useState(!!u.admin_can_manage_rooms);
  const fetcher = useFetcher();
  const permFetcher = useFetcher();
  const saving = fetcher.state === 'submitting';
  const savingPerms = permFetcher.state === 'submitting';
  const resetFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [copiedRow, setCopiedRow] = useState(false);

  function copyRowMessage() {
    const msg = `Twoje konto do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało utworzone.\nDane do pierwszego logowania:\nAdres e-mail: ${u.email}\nHasło: ${tempPasswordFromName(u.name)}\n\nPo pierwszym zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli zapomnisz swoje hasło, skontaktuj się z recepcją.`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedRow(true);
      setTimeout(() => setCopiedRow(false), 2000);
    });
  }

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'success' in fetcher.data) {
      setEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (permFetcher.state === 'idle' && permFetcher.data && 'success' in permFetcher.data) {
      setPermEditing(false);
    }
  }, [permFetcher.state, permFetcher.data]);

  useEffect(() => {
    if (!editing) {
      setEditName(u.name);
      setEditEmail(u.email);
    }
  }, [u.name, u.email, editing]);

  useEffect(() => {
    setPermAssignAdmin(!!u.admin_can_assign_admin);
    setPermAssignZarzad(!!u.admin_can_assign_zarzad);
    setPermAssignPracownik(!!u.admin_can_assign_pracownik);
    setPermManageRooms(!!u.admin_can_manage_rooms);
  }, [u.admin_can_assign_admin, u.admin_can_assign_zarzad, u.admin_can_assign_pracownik, u.admin_can_manage_rooms]);

  function handleSave() {
    const fd = new FormData();
    fd.set('_action', 'edit_profile');
    fd.set('user_id', String(u.id));
    fd.set('name', editName.trim());
    fd.set('email', editEmail.trim().toLowerCase());
    fetcher.submit(fd, { method: 'post' });
  }

  const fetcherError = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null;

  return (
    <>
      <tr className={u.is_active ? "" : "opacity-50"}>
        <td className="px-4 py-3 font-medium text-gray-900">
          {editing ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          ) : u.name}
        </td>
        <td className="px-4 py-3 text-gray-500">
          {editing ? (
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          ) : u.email}
        </td>
        <td className="px-4 py-3">
          {u.role === 'super_admin' && currentUser.role !== 'super_admin' ? (
            <span className="text-xs px-2 py-1 text-gray-500">{ROLE_LABELS[u.role]}</span>
          ) : (
            <Form method="post" className="inline-flex items-center gap-2">
              <input type="hidden" name="_action" value="edit" />
              <input type="hidden" name="user_id" value={u.id} />
              <input type="hidden" name="name" value={u.name} />
              <select
                name="role"
                defaultValue={u.role}
                onChange={e => (e.currentTarget.form as HTMLFormElement).submit()}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {allowedRoles.includes(u.role) || currentUser.role === 'super_admin'
                  ? [...new Set([...allowedRoles, u.role])].map(r => (
                      <option key={r} value={r} disabled={!allowedRoles.includes(r)}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))
                  : <option value={u.role}>{ROLE_LABELS[u.role]}</option>
                }
              </select>
            </Form>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
            {u.is_active ? 'Aktywny' : 'Nieaktywny'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !editName.trim() || !editEmail.trim()}
                  title="Zapisz"
                  className="text-green-600 hover:text-green-800 disabled:opacity-40 transition-colors"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditName(u.name); setEditEmail(u.email); }}
                  title="Anuluj"
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                {!isSelf && (u.role !== 'super_admin' || currentUser.role === 'super_admin') && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    title="Edytuj imię i e-mail"
                    className="text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {currentUser.role === 'super_admin' && u.role === 'admin' && !isSelf && (
                  <button
                    type="button"
                    onClick={() => setPermEditing(v => !v)}
                    title="Uprawnienia administratora"
                    className={`transition-colors ${permEditing ? 'text-blue-600' : 'text-gray-300 hover:text-blue-500'}`}
                  >
                    <Shield size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyRowMessage}
                  title="Kopiuj wiadomość z tymczasowymi danymi logowania"
                  className="text-gray-300 hover:text-blue-500 transition-colors"
                >
                  {copiedRow ? <Check size={16} /> : <Copy size={16} />}
                </button>
                {!isSelf && (u.role !== 'super_admin' || currentUser.role === 'super_admin') && (
                  <Form method="post" ref={resetFormRef} className="inline-flex items-center">
                    <input type="hidden" name="_action" value="reset_password" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <button
                      type="button"
                      disabled={pending}
                      title="Resetuj hasło"
                      className="text-gray-300 hover:text-blue-500 transition-colors"
                      onClick={() => onRequestConfirm({
                        message: `Zresetować hasło użytkownika ${u.name}? Nowe hasło zostanie pokazane w bannerze.`,
                        onConfirm: () => resetFormRef.current?.requestSubmit(),
                      })}
                    >
                      <KeyRound size={16} />
                    </button>
                  </Form>
                )}
                {!isSelf && (u.role !== 'super_admin' || currentUser.role === 'super_admin') && (
                  <Form method="post" className="inline-flex items-center">
                    <input type="hidden" name="_action" value="toggle_active" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <button type="submit" disabled={pending} title={u.is_active ? "Dezaktywuj" : "Aktywuj"} className="text-gray-400 hover:text-gray-700 transition-colors">
                      {u.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                    </button>
                  </Form>
                )}
                {!isSelf && (u.role !== 'super_admin' || currentUser.role === 'super_admin') && (
                  <Form method="post" ref={deleteFormRef} className="inline-flex items-center">
                    <input type="hidden" name="_action" value="delete_user" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <button
                      type="button"
                      disabled={pending}
                      title="Usuń użytkownika"
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      onClick={() => onRequestConfirm({
                        message: `Usunąć użytkownika ${u.name}? Operacja jest nieodwracalna.`,
                        onConfirm: () => deleteFormRef.current?.requestSubmit(),
                      })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </Form>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {editing && fetcherError && (
        <tr>
          <td colSpan={5} className="px-4 pb-2">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1">{fetcherError}</p>
          </td>
        </tr>
      )}
      {permEditing && currentUser.role === 'super_admin' && u.role === 'admin' && (
        <tr>
          <td colSpan={5} className="px-4 pt-2 pb-3">
            <permFetcher.Form method="post" className="border border-blue-100 bg-blue-50 rounded-lg px-4 py-3 space-y-2">
              <input type="hidden" name="_action" value="set_admin_permissions" />
              <input type="hidden" name="user_id" value={u.id} />
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-blue-700 flex items-center gap-1.5"><Shield size={13} /> Uprawnienia administratora</span>
                <button type="submit" disabled={savingPerms}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0">
                  {savingPerms ? 'Zapisuję…' : 'Zapisz'}
                </button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_admin" value="1"
                    checked={permAssignAdmin} onChange={e => setPermAssignAdmin(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć administratorów
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_zarzad" value="1"
                    checked={permAssignZarzad} onChange={e => setPermAssignZarzad(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć Zarząd
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_assign_pracownik" value="1"
                    checked={permAssignPracownik} onChange={e => setPermAssignPracownik(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może tworzyć Biuro
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" name="admin_can_manage_rooms" value="1"
                    checked={permManageRooms} onChange={e => setPermManageRooms(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Może zarządzać salami
                </label>
              </div>
              {permFetcher.data && 'error' in permFetcher.data && (
                <p className="text-xs text-red-600">{(permFetcher.data as { error: string }).error}</p>
              )}
            </permFetcher.Form>
          </td>
        </tr>
      )}
    </>
  );
}
