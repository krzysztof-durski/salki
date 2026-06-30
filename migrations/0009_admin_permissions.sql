-- Per-admin privilege flags (only meaningful when role = 'admin').
-- Defaults mirror existing hardcoded behaviour so existing admin accounts are unaffected.
ALTER TABLE users ADD COLUMN admin_can_assign_admin     INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN admin_can_assign_zarzad    INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN admin_can_assign_pracownik INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN admin_can_manage_rooms     INTEGER DEFAULT 0;
