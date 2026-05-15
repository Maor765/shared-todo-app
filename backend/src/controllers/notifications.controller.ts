import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const result = await query(
      `SELECT id, user_id, type, text, context, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: notifId } = req.params;
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const result = await query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, type, text, context, read, created_at`,
      [notifId, userId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'Notification not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const result = await query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [userId],
    );

    res.json({ updated: result.rowCount });
  } catch (error) {
    next(error);
  }
}
