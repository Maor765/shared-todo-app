import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { PublicUser } from '../types.js';
import { onMemberAdded } from '../services/notifications.service.js';

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

export async function getMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    if (!workspaceId) throw new AppError(401, 'Unauthorized');

    const result = await query(
      `SELECT u.id, u.email, u.name, u.initials, u.color, u.text_color, u.role, u.status
       FROM users u
       JOIN workspace_members wm ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY u.created_at ASC`,
      [workspaceId],
    );

    res.json(result.rows.map(toPublicUser));
  } catch (error) {
    next(error);
  }
}

export async function getInvites(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    if (!workspaceId) throw new AppError(401, 'Unauthorized');

    const result = await query(
      `SELECT id, email, role, created_at FROM workspace_invites WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function deleteInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    const role = req.user?.role;
    const { inviteId } = req.params;

    if (!workspaceId || role !== 'admin') throw new AppError(403, 'Forbidden: admin only');

    await query(
      `DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2`,
      [inviteId, workspaceId],
    );

    res.json({ message: 'Invite cancelled' });
  } catch (error) {
    next(error);
  }
}

export async function inviteMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    const userId = req.user?.sub;
    const role = req.user?.role;

    if (!workspaceId || role !== 'admin') {
      throw new AppError(403, 'Forbidden: admin only');
    }

    const { email: rawEmail, role: newRole } = req.body;
    if (!rawEmail) {
      throw new AppError(400, 'Email required');
    }
    const email = rawEmail.toLowerCase();

    const existingUser = await query(
      `SELECT id, name FROM users WHERE email = $1`,
      [email],
    );

    if (existingUser.rowCount > 0) {
      const invitedUserId = existingUser.rows[0].id;
      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [workspaceId, invitedUserId, newRole || 'member'],
      );
      const workspaceResult = await query(`SELECT name FROM workspaces WHERE id = $1`, [workspaceId]);
      await onMemberAdded(invitedUserId, existingUser.rows[0].name, workspaceId, workspaceResult.rows[0].name);
    } else {
      await query(
        `INSERT INTO workspace_invites (workspace_id, email, role, invited_by)
         VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, email) DO NOTHING`,
        [workspaceId, email, newRole || 'member', userId],
      );
    }

    res.json({ message: 'Invite sent' });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    const { status } = req.body;

    if (!status || !['active', 'away'].includes(status)) {
      throw new AppError(400, 'Valid status required');
    }

    const result = await query(
      `UPDATE users SET status = $1 WHERE id = $2
       RETURNING id, email, name, initials, color, text_color, role, status`,
      [status, userId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'User not found');
    }

    res.json(toPublicUser(result.rows[0]));
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    const role = req.user?.role;
    const { userId } = req.params;

    if (!workspaceId || role !== 'admin') {
      throw new AppError(403, 'Forbidden: admin only');
    }

    await query(
      `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
}
