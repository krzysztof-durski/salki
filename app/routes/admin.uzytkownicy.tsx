import { redirect, data, Form, useNavigation, useFetcher } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/admin.uzytkownicy";
import { getTokenFromRequest, getSessionUser, requireUser, hashPassword, generateToken } from "~/lib/auth.server";
import { queryAll, queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { sendEmail, tplAccountCreated } from "~/lib/email.server";
import { canManageUsers, assignableRoles, ROLE_LABELS } from "~/types";
import type { User } from "~/types";
import { Plus, ToggleLeft, ToggleRight, Trash2, Copy, Check, X, KeyRound, Pencil } from "lucide-react";
import { ConfirmModal } from "~/components/ConfirmModal";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageUsers(user.role)) throw new Response(null, { status: 403 });

  const users = await queryAll<User>(
    env.DB,
    "SELECT id, email, name, role, is_active, on_duty, created_at FROM users ORDER BY name ASC"
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
    const allowed = assignableRoles(actor.role);
    if (!allowed.includes(role)) return data({ error: "Brak uprawnień do przypisania tej roli." }, { status: 403 });

    const tempPass = generateToken(6); // 12-char hex
    const hash = await hashPassword(tempPass);

    try {
      await execute(
        env.DB,
        "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
        [email, name, hash, role]
      );
    } catch {
      return data({ error: "Adres e-mail jest już zajęty." }, { status: 409 });
    }

    const appUrl = new URL(request.url).origin;
    const tpl = tplAccountCreated({ name, tempPassword: tempPass, appUrl });
    const { sent: emailSent, error: emailError } = await sendEmail(env, { to: email, ...tpl });
    await logAction(env.DB, { userId: actor.id, action: 'user.created', entityType: 'user', details: { email, role } });
    return data({ created: { name, email, tempPassword: tempPass, emailSent, emailError, reason: 'created' as const } });
  }

  else if (_action === "edit") {
    const userId = parseInt(form.get("user_id") as string, 10);
    const name = (form.get("name") as string)?.trim();
    const role = form.get("role") as User['role'];
    const allowed = assignableRoles(actor.role);
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
    const tempPass = generateToken(6);
    const hash = await hashPassword(tempPass);
    await execute(env.DB, "UPDATE users SET password_hash=?, must_change_password=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", [hash, userId]);
    const appUrl = new URL(request.url).origin;
    const tpl = tplAccountCreated({ name: target.name, tempPassword: tempPass, appUrl });
    const { sent: emailSent, error: emailError } = await sendEmail(env, { to: target.email, ...tpl });
    await logAction(env.DB, { userId: actor.id, action: 'user.password_reset', entityType: 'user', entityId: userId });
    return data({ created: { name: target.name, email: target.email, tempPassword: tempPass, emailSent, emailError, reason: 'reset' as const } });
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

  return redirect("/admin/uzytkownicy");
}

export default function AdminUzytkownicy({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser, users } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const allowedRoles = assignableRoles(currentUser.role);
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const autoCopyRef = useRef(false);

  const created = actionData && 'created' in actionData ? actionData.created : null;
  const showBanner = !!created && !bannerDismissed;

  function buildMessage(c: NonNullable<typeof created>) {
    if (c.reason === 'reset') {
      return `Twoje hasło do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało zresetowane.\nDane do logowania:\nAdres e-mail: ${c.email}\nNowe hasło tymczasowe: ${c.tempPassword}\n\nPo zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli masz problem z logowaniem, skontaktuj się z Administratorem.`;
    }
    return `Twoje konto do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało utworzone.\nDane do pierwszego logowania:\nAdres e-mail: ${c.email}\nHasło: ${c.tempPassword}\n\nPo pierwszym zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli zapomnisz swoje hasło, skontaktuj się z Administratorem.`;
  }

  useEffect(() => {
    if (created) setBannerDismissed(false);
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
              <p className={`text-xs ${created.emailSent ? 'text-green-700' : 'text-amber-700 font-medium'}`}>
                {created.emailSent
                  ? '✓ Email z hasłem został wysłany do użytkownika.'
                  : '⚠ Nie udało się wysłać e-maila — przekaż hasło ręcznie.'}
              </p>
              {!created.emailSent && created.emailError && (
                <p className="text-xs text-amber-600 font-mono break-all">{created.emailError}</p>
              )}
              <button
                type="button"
                onClick={copyMessage}
                className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 border border-green-300 bg-green-100 hover:bg-green-200 rounded-lg px-3 py-1.5 transition-colors mt-1"
              >
                {copiedMsg ? <Check size={13} /> : <Copy size={13} />}
                {copiedMsg ? 'Skopiowano!' : 'Kopiuj wiadomość powitalną'}
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
        <Form method="post" className="grid grid-cols-1 sm:grid-cols-4 gap-3" onSubmit={() => setBannerDismissed(true)}>
          <input type="hidden" name="_action" value="create" />
          <input name="name" type="text" placeholder="Imię i nazwisko" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input name="email" type="email" placeholder="Adres e-mail" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <select name="role" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="">— rola —</option>
            {allowedRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Dodaj
          </button>
        </Form>
        {actionData && 'error' in actionData && actionData.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Copy size={12} /> Kopiuj wiadomość</span>
          <span className="flex items-center gap-1"><Pencil size={12} /> Edytuj</span>
          <span className="flex items-center gap-1"><ToggleLeft size={14} /><ToggleRight size={14} /> Aktywuj / Dezaktywuj</span>
          <span className="flex items-center gap-1"><KeyRound size={12} /> Resetuj hasło</span>
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
            {users.map(u => (
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
  const fetcher = useFetcher();
  const saving = fetcher.state === 'submitting';
  const resetFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [copiedRow, setCopiedRow] = useState(false);

  function copyRowMessage() {
    const msg = `Twoje konto do Systemu Rezerwacji Salek Lafrentz (salki.lafrentz.pl) zostało utworzone.\nDane do pierwszego logowania:\nAdres e-mail: ${u.email}\nHasło: [hasło]\n\nPo pierwszym zalogowaniu trzeba będzie ustawić nowe hasło. Jeśli zapomnisz swoje hasło, skontaktuj się z Administratorem.`;
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
    if (!editing) {
      setEditName(u.name);
      setEditEmail(u.email);
    }
  }, [u.name, u.email, editing]);

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
                <button
                  type="button"
                  onClick={copyRowMessage}
                  title="Kopiuj wiadomość powitalną"
                  className="text-gray-300 hover:text-blue-500 transition-colors"
                >
                  {copiedRow ? <Check size={16} /> : <Copy size={16} />}
                </button>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    title="Edytuj imię i e-mail"
                    className="text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {!isSelf && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="toggle_active" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <button type="submit" disabled={pending} title={u.is_active ? "Dezaktywuj" : "Aktywuj"} className="text-gray-400 hover:text-gray-700 transition-colors">
                      {u.is_active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                    </button>
                  </Form>
                )}
                {!isSelf && (
                  <Form method="post" ref={resetFormRef} className="inline">
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
                {!isSelf && (
                  <Form method="post" ref={deleteFormRef} className="inline">
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
    </>
  );
}
