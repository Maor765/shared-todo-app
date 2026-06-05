import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { ListWithMembers, ListDetail, PublicUser } from '../types.js';
import { Server } from 'socket.io';

let io: Server;

export function initListsIO(ioInstance: Server) {
  io = ioInstance;
}

function toPublicUser(row: any): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    initials: row.initials,
    color: row.color,
    text_color: row.text_color,
    role: row.role,
    status: row.status,
  };
}

async function getListWithMembers(
  listId: string,
): Promise<ListWithMembers | null> {
  const listResult = await query(
    `SELECT id, workspace_id, name, emoji, shared, created_by, created_at FROM lists WHERE id = $1`,
    [listId],
  );

  if (listResult.rowCount === 0) return null;

  const list = listResult.rows[0];

  let membersResult;
  if (list.shared) {
    // For shared lists, show all workspace members
    membersResult = await query(
      `SELECT u.id, u.email, u.name, u.initials, u.color, u.text_color, u.role, u.status
       FROM users u
       JOIN workspace_members wm ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY u.created_at ASC`,
      [list.workspace_id],
    );
  } else {
    // For private lists, show only explicit members
    membersResult = await query(
      `SELECT u.id, u.email, u.name, u.initials, u.color, u.text_color, u.role, u.status
       FROM users u
       JOIN list_members lm ON u.id = lm.user_id
       WHERE lm.list_id = $1
       ORDER BY u.created_at ASC`,
      [listId],
    );
  }

  return {
    ...list,
    members: membersResult.rows.map(toPublicUser),
  };
}

export async function getLists(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    const userId = req.user?.sub;

    if (!workspaceId || !userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const result = await query(
      `SELECT DISTINCT l.id, l.workspace_id, l.name, l.emoji, l.shared, l.created_by, l.created_at
       FROM lists l
       LEFT JOIN list_members lm ON l.id = lm.list_id AND lm.user_id = $2
       WHERE l.workspace_id = $1 AND (l.shared = true OR lm.user_id = $2)
       ORDER BY l.created_at DESC`,
      [workspaceId, userId],
    );

    const listIds = result.rows.map((r: any) => r.id);

    const lists: ListWithMembers[] = [];
    for (const row of result.rows) {
      const listWithMembers = await getListWithMembers(row.id);
      if (listWithMembers) lists.push(listWithMembers);
    }

    if (listIds.length > 0) {
      const tasksResult = await query(
        `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, created_by, created_at, updated_at
         FROM tasks WHERE list_id = ANY($1) ORDER BY created_at DESC`,
        [listIds],
      );
      const tasksByList: Record<string, any[]> = {};
      for (const task of tasksResult.rows) {
        if (!tasksByList[task.list_id]) tasksByList[task.list_id] = [];
        tasksByList[task.list_id].push(task);
      }
      for (const list of lists) {
        (list as any).tasks = tasksByList[list.id] || [];
      }
    }

    res.json(lists);
  } catch (error) {
    next(error);
  }
}

export async function createList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    const userId = req.user?.sub;
    const { name, emoji, shared } = req.body;

    if (!workspaceId || !userId) {
      throw new AppError(401, 'Unauthorized');
    }

    if (!name) {
      throw new AppError(400, 'Name required');
    }

    const listResult = await query(
      `INSERT INTO lists (workspace_id, name, emoji, shared, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workspace_id, name, emoji, shared, created_by, created_at`,
      [workspaceId, name, emoji || '📋', shared !== false, userId],
    );

    const list = listResult.rows[0];

    await query(
      `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)`,
      [list.id, userId],
    );

    const listWithMembers = await getListWithMembers(list.id);

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('list:created', { list: listWithMembers });
    }

    res.status(201).json(listWithMembers);
  } catch (error) {
    next(error);
  }
}

export async function getListDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: listId } = req.params;
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const listResult = await query(
      `SELECT l.id, l.workspace_id, l.name, l.emoji, l.shared, l.created_by, l.created_at
       FROM lists l
       LEFT JOIN list_members lm ON l.id = lm.list_id AND lm.user_id = $2
       WHERE l.id = $1 AND (l.shared = true OR lm.user_id = $2)`,
      [listId, userId],
    );

    if (listResult.rowCount === 0) {
      throw new AppError(404, 'List not found');
    }

    const list = listResult.rows[0];

    const membersResult = await query(
      `SELECT u.id, u.email, u.name, u.initials, u.color, u.text_color, u.role, u.status
       FROM users u
       JOIN list_members lm ON u.id = lm.user_id
       WHERE lm.list_id = $1
       ORDER BY u.created_at ASC`,
      [listId],
    );

    const sublistsResult = await query(
      `SELECT id, list_id, name, created_at FROM sublists WHERE list_id = $1 ORDER BY created_at ASC`,
      [listId],
    );

    const tasksResult = await query(
      `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, created_by, created_at, updated_at
       FROM tasks WHERE list_id = $1
       ORDER BY created_at DESC`,
      [listId],
    );

    const detail: ListDetail = {
      ...list,
      members: membersResult.rows.map(toPublicUser),
      sublists: sublistsResult.rows,
      tasks: tasksResult.rows,
    };

    res.json(detail);
  } catch (error) {
    next(error);
  }
}

export async function updateList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: listId } = req.params;
    const userId = req.user?.sub;
    const { name, emoji, shared } = req.body;

    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (emoji !== undefined) {
      updates.push(`emoji = $${paramIndex++}`);
      values.push(emoji);
    }

    if (shared !== undefined) {
      updates.push(`shared = $${paramIndex++}`);
      values.push(shared);
    }

    if (updates.length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    values.push(listId);

    const result = await query(
      `UPDATE lists SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, workspace_id, name, emoji, shared, created_by, created_at`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'List not found');
    }

    const listWithMembers = await getListWithMembers(result.rows[0].id);

    res.json(listWithMembers);
  } catch (error) {
    next(error);
  }
}

export async function deleteList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: listId } = req.params;
    const workspaceId = req.user?.workspace_id;

    await query(`DELETE FROM lists WHERE id = $1`, [listId]);

    if (io && workspaceId) {
      io.to(`workspace:${workspaceId}`).emit('list:deleted', { list_id: listId });
    }

    res.json({ message: 'List deleted' });
  } catch (error) {
    next(error);
  }
}

export async function addListMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: listId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new AppError(400, 'User ID required');
    }

    await query(
      `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [listId, userId],
    );

    const listWithMembers = await getListWithMembers(listId);

    res.json(listWithMembers);
  } catch (error) {
    next(error);
  }
}

export async function removeListMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: listId, userId } = req.params;

    await query(
      `DELETE FROM list_members WHERE list_id = $1 AND user_id = $2`,
      [listId, userId],
    );

    const listWithMembers = await getListWithMembers(listId);

    res.json(listWithMembers);
  } catch (error) {
    next(error);
  }
}
