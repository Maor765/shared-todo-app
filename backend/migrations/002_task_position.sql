ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

UPDATE tasks t
SET position = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY created_at ASC) AS rn
  FROM tasks
) sub
WHERE t.id = sub.id;
