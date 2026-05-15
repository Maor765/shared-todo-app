import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.user?.workspace_id;
    if (!workspaceId) throw new AppError(401, 'Unauthorized');

    const result = await query(
      `SELECT id, name, owner_id, created_at FROM workspaces WHERE id = $1`,
      [workspaceId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'Workspace not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateWorkspace(
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

    const { name } = req.body;
    if (!name) {
      throw new AppError(400, 'Name required');
    }

    const result = await query(
      `UPDATE workspaces SET name = $1 WHERE id = $2 RETURNING id, name, owner_id, created_at`,
      [name, workspaceId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'Workspace not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
