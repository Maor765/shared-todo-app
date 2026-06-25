CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ──────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  initials      TEXT NOT NULL,
  color         TEXT NOT NULL,
  text_color    TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','away')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── WORKSPACES ─────────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── WORKSPACE MEMBERS ──────────────────────────────────────────────────────────
CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ── LISTS ──────────────────────────────────────────────────────────────────────
CREATE TABLE lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📋',
  shared       BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── LIST MEMBERS ───────────────────────────────────────────────────────────────
CREATE TABLE list_members (
  list_id  UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, user_id)
);

-- ── SUBLISTS ───────────────────────────────────────────────────────────────────
CREATE TABLE sublists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── TASKS ──────────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  sublist_id  UUID REFERENCES sublists(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due         DATE,
  notes       TEXT NOT NULL DEFAULT '',
  amount      FLOAT8,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── NOTIFICATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('done','assign','due','member','create')),
  text       TEXT NOT NULL,
  context    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── WORKSPACE INVITES ─────────────────────────────────────────────────────────
CREATE TABLE workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

-- ── INDEXES ────────────────────────────────────────────────────────────────────
CREATE INDEX idx_workspace_members_user  ON workspace_members(user_id);
CREATE INDEX idx_lists_workspace         ON lists(workspace_id);
CREATE INDEX idx_list_members_user       ON list_members(user_id);
CREATE INDEX idx_sublists_list           ON sublists(list_id);
CREATE INDEX idx_tasks_list              ON tasks(list_id);
CREATE INDEX idx_tasks_assignee          ON tasks(assignee_id);
CREATE INDEX idx_tasks_due               ON tasks(due) WHERE done = false;
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
