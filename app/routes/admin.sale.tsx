import { redirect, data, Form, useNavigation } from "react-router";
import type { Route } from "./+types/admin.sale";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canManageRooms } from "~/types";
import type { Room } from "~/types";
import { Plus, DoorOpen } from "lucide-react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageRooms(user)) throw new Response(null, { status: 403 });

  const rooms = await queryAll<Room>(
    env.DB,
    "SELECT * FROM rooms ORDER BY sort_order ASC"
  );
  return { rooms };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageRooms(user)) throw new Response(null, { status: 403 });

  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const name = (form.get("name") as string)?.trim();
    const sizeLabel = (form.get("size_label") as string)?.trim() || null;
    const category = form.get("category") as string;
    const sortOrder = parseInt(form.get("sort_order") as string || "0", 10);
    if (!name || !category) return data({ error: "Nazwa i kategoria są wymagane." }, { status: 400 });
    await execute(
      env.DB,
      "INSERT INTO rooms (name, size_label, category, sort_order) VALUES (?, ?, ?, ?)",
      [name, sizeLabel, category, sortOrder]
    );
    await logAction(env.DB, { userId: user.id, action: 'room.created', entityType: 'room', details: { name, category }, request });
  }

  else if (_action === "edit") {
    const roomId = parseInt(form.get("room_id") as string, 10);
    const name = (form.get("name") as string)?.trim();
    const sizeLabel = (form.get("size_label") as string)?.trim() || null;
    const category = form.get("category") as string;
    const sortOrder = parseInt(form.get("sort_order") as string || "0", 10);
    await execute(
      env.DB,
      "UPDATE rooms SET name=?, size_label=?, category=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [name, sizeLabel, category, sortOrder, roomId]
    );
    await logAction(env.DB, { userId: user.id, action: 'room.edited', entityType: 'room', entityId: roomId, request });
  }

  else if (_action === "toggle_active") {
    const roomId = parseInt(form.get("room_id") as string, 10);
    await execute(
      env.DB,
      "UPDATE rooms SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [roomId]
    );
    await logAction(env.DB, { userId: user.id, action: 'room.toggled', entityType: 'room', entityId: roomId, request });
  }

  return redirect("/admin/sale");
}

export default function AdminSale({ loaderData, actionData }: Route.ComponentProps) {
  const { rooms } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Zarządzanie salami</h1>

      {/* Add room */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Plus size={18} /> Dodaj salę</h2>
        <Form method="post" className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input type="hidden" name="_action" value="create" />
          <input name="name" type="text" placeholder="Nazwa sali" required className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input name="size_label" type="text" placeholder="Pojemność (np. 4–8 osób)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <select name="category" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="">— kategoria —</option>
            <option value="general">Ogólna</option>
            <option value="board">Zarząd</option>
          </select>
          <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Dodaj
          </button>
        </Form>
        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
        )}
      </div>

      {/* Rooms list */}
      <div className="space-y-3">
        {rooms.map(room => (
          <div key={room.id} className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm ${!room.is_active ? 'opacity-60' : ''}`}>
            <Form method="post" className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
              <input type="hidden" name="_action" value="edit" />
              <input type="hidden" name="room_id" value={room.id} />

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa</label>
                <input name="name" type="text" defaultValue={room.name} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pojemność</label>
                <input name="size_label" type="text" defaultValue={room.size_label ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kategoria</label>
                <select name="category" defaultValue={room.category} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="general">Ogólna</option>
                  <option value="board">Zarząd</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kolejność</label>
                <input name="sort_order" type="number" defaultValue={room.sort_order} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className="flex-1 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg">
                  Zapisz
                </button>
              </div>
            </Form>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className={`text-xs px-2 py-0.5 rounded-full ${room.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {room.is_active ? 'Aktywna' : 'Nieaktywna'}
              </span>
              <Form method="post">
                <input type="hidden" name="_action" value="toggle_active" />
                <input type="hidden" name="room_id" value={room.id} />
                <button type="submit" disabled={pending} className="text-xs text-gray-500 hover:text-gray-800 underline">
                  {room.is_active ? "Dezaktywuj" : "Aktywuj"}
                </button>
              </Form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
