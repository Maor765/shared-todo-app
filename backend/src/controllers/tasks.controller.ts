import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  onTaskCompleted,
  onTaskAssigned,
} from '../services/notifications.service.js';
import { Server } from 'socket.io';

let io: Server;

export function initTasksIO(ioInstance: Server) {
  io = ioInstance;
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId } = req.params;
    const userId = req.user?.sub;
    const workspaceId = req.user?.workspace_id;
    const { text, sublist_id, assignee_id, due, notes, amount } = req.body;

    if (!userId || !workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    if (!text) {
      throw new AppError(400, 'Text required');
    }

    const result = await query(
      `INSERT INTO tasks (list_id, sublist_id, text, assignee_id, due, notes, amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, list_id, sublist_id, text, done, assignee_id, due, notes, amount, created_by, created_at, updated_at`,
      [listId, sublist_id || null, text, assignee_id || null, due || null, notes || '', amount ?? null, userId],
    );

    const task = result.rows[0];

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('task:created', {
        task,
        list_id: listId,
      });
    }

    if (assignee_id) {
      const userResult = await query(
        `SELECT name FROM users WHERE id = $1`,
        [userId],
      );
      const assigneeResult = await query(
        `SELECT name FROM users WHERE id = $1`,
        [assignee_id],
      );
      const listResult = await query(`SELECT name FROM lists WHERE id = $1`, [listId]);

      await onTaskAssigned(
        task.id,
        task.text,
        listId,
        listResult.rows[0]?.name || 'List',
        assignee_id,
        assigneeResult.rows[0]?.name || 'User',
        userId,
        userResult.rows[0]?.name || 'User',
      );
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId, id: taskId } = req.params;
    const userId = req.user?.sub;
    const workspaceId = req.user?.workspace_id;
    const { text, done, sublist_id, assignee_id, due, notes, amount } = req.body;

    if (!userId || !workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    const currentResult = await query(
      `SELECT done, assignee_id FROM tasks WHERE id = $1 AND list_id = $2`,
      [taskId, listId],
    );

    if (currentResult.rowCount === 0) {
      throw new AppError(404, 'Task not found');
    }

    const currentTask = currentResult.rows[0];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (text !== undefined) {
      updates.push(`text = $${paramIndex++}`);
      values.push(text);
    }

    if (done !== undefined) {
      updates.push(`done = $${paramIndex++}`);
      values.push(done);
    }

    if (sublist_id !== undefined) {
      updates.push(`sublist_id = $${paramIndex++}`);
      values.push(sublist_id || null);
    }

    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      values.push(assignee_id || null);
    }

    if (due !== undefined) {
      updates.push(`due = $${paramIndex++}`);
      values.push(due || null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(amount ?? null);
    }

    updates.push(`updated_at = NOW()`);
    values.push(taskId, listId);

    const result = await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} AND list_id = $${paramIndex + 1}
       RETURNING id, list_id, sublist_id, text, done, assignee_id, due, notes, amount, created_by, created_at, updated_at`,
      values,
    );

    const updatedTask = result.rows[0];

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('task:updated', {
        task: updatedTask,
        list_id: listId,
      });
    }

    if (done && !currentTask.done) {
      const userResult = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const listResult = await query(`SELECT name FROM lists WHERE id = $1`, [listId]);

      await onTaskCompleted(
        taskId,
        updatedTask.text,
        listId,
        listResult.rows[0]?.name || 'List',
        userId,
        userResult.rows[0]?.name || 'User',
      );
    }

    if (
      assignee_id !== undefined &&
      assignee_id !== currentTask.assignee_id &&
      assignee_id
    ) {
      const userResult = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const assigneeResult = await query(
        `SELECT name FROM users WHERE id = $1`,
        [assignee_id],
      );
      const listResult = await query(`SELECT name FROM lists WHERE id = $1`, [listId]);

      await onTaskAssigned(
        taskId,
        updatedTask.text,
        listId,
        listResult.rows[0]?.name || 'List',
        assignee_id,
        assigneeResult.rows[0]?.name || 'User',
        userId,
        userResult.rows[0]?.name || 'User',
      );
    }

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId, id: taskId } = req.params;
    const workspaceId = req.user?.workspace_id;

    if (!workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    await query(`DELETE FROM tasks WHERE id = $1 AND list_id = $2`, [
      taskId,
      listId,
    ]);

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('task:deleted', {
        task_id: taskId,
        list_id: listId,
      });
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
}
