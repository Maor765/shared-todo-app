-- Allow Google-only users who have no password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google's stable user identifier (sub claim) for account matching and linking
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
