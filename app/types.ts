export type Role = 'super_admin' | 'admin' | 'zarzad' | 'pracownik';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  zarzad: 'Zarząd',
  pracownik: 'Biuro',
};

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'counter_proposed';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type RoomCategory = 'general' | 'board';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  must_change_password: number;
  is_active: number;
  on_duty: number;
  preferred_room_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  name: string;
  size_label: string | null;
  category: RoomCategory;
  is_active: number;
  sort_order: number;
}

export interface Booking {
  id: number;
  room_id: number;
  room_name?: string;
  requester_id: number;
  requester_name?: string;
  created_by_admin_id: number | null;
  title: string | null;
  date: string;
  start_time: string;
  end_time: string;
  attendee_count: number | null;
  attendee_emails: string | null;
  status: BookingStatus;
  requester_note: string | null;
  admin_note: string | null;
  counter_date: string | null;
  counter_start_time: string | null;
  counter_end_time: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BookingChangeRequest {
  id: number;
  booking_id: number;
  requester_id: number;
  requester_name?: string;
  new_date: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  new_attendee_count: number | null;
  new_attendee_emails: string | null;
  new_title: string | null;
  requester_note: string | null;
  status: ChangeRequestStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export function canViewBoardRooms(role: Role): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'zarzad';
}

export function canDirectBookBoardRoom(role: Role): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'zarzad';
}

export function canDirectBookGeneralRoom(role: Role): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canManageBookings(role: Role): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canManageUsers(role: Role): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canAssignZarzadRole(role: Role): boolean {
  return role === 'super_admin';
}

export function canManageRooms(role: Role): boolean {
  return role === 'super_admin';
}

export function canViewAuditLogs(role: Role): boolean {
  return role === 'super_admin';
}

export function isAdmin(role: Role): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function assignableRoles(actorRole: Role): Role[] {
  const all: Role[] = ['admin', 'zarzad', 'pracownik'];
  if (actorRole === 'super_admin') return all;
  return all.filter(r => r !== 'zarzad');
}
