-- Remove dyrektor role: convert existing dyrektor users to pracownik (displayed as "Biuro").
-- D1 cannot recreate the users table due to FK constraints, so the CHECK constraint
-- retains dyrektor/pracownik as valid DB values. The app no longer exposes dyrektor.
UPDATE users SET role = 'pracownik' WHERE role = 'dyrektor';
