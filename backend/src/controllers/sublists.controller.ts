import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { onSublistCreated } from '../services/notifications.service.js';
import { Server } from 'socket.io';

let io: Server;

export function initSublistsIO(ioInstance: Server) {
  io = ioInstance;
}

export async function createSublist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId } = req.params;
    const userId = req.user?.sub;
    const workspaceId = req.user?.workspace_id;
    const { name } = req.body;

    if (!userId || !workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    if (!name) {
      throw new AppError(400, 'Name required');
    }

    const result = await query(
      `INSERT INTO sublists (list_id, name) VALUES ($1, $2) RETURNING id, list_id, name, created_at`,
      [listId, name],
    );

    const sublist = result.rows[0];

    const listResult = await query(
      `SELECT name FROM lists WHERE id = $1`,
      [listId],
    );

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('sublist:created', {
        sublist,
        list_id: listId,
      });
    }

    const listName = listResult.rows[0]?.name || 'List';
    await onSublistCreated(sublist.id, sublist.name, listId, listName, userId, '');

    res.status(201).json(sublist);
  } catch (error) {
    next(error);
  }
}

export async function updateSublist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId, id: sublistId } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new AppError(400, 'Name required');
    }

    const result = await query(
      `UPDATE sublists SET name = $1 WHERE id = $2 AND list_id = $3
       RETURNING id, list_id, name, created_at`,
      [name, sublistId, listId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'Sublist not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteSublist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId, id: sublistId } = req.params;
    const workspaceId = req.user?.workspace_id;

    if (!workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    await query(
      `UPDATE tasks SET sublist_id = NULL WHERE sublist_id = $1`,
      [sublistId],
    );

    await query(
      `DELETE FROM sublists WHERE id = $1 AND list_id = $2`,
      [sublistId, listId],
    );

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('sublist:deleted', {
        sublist_id: sublistId,
        list_id: listId,
      });
    }

    res.json({ message: 'Sublist deleted' });
  } catch (error) {
    next(error);
  }
}
