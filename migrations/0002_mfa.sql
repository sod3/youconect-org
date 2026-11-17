ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS user_mfa (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, encrypted_secret text NOT NULL, enabled boolean NOT NULL DEFAULT false, last_counter bigint NOT NULL DEFAULT -1, backup_hashes jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
