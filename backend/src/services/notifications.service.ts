import { Server } from 'socket.io';
import { query } from '../db.js';
import { DBNotification } from '../types.js';

let io: Server;

export function initNotificationsService(ioInstance: Server) {
  io = ioInstance;
}

async function createNotification(
  userId: string,
  type: string,
  text: string,
  context: string,
): Promise<DBNotification> {
  const result = await query<DBNotification>(
    `INSERT INTO notifications (user_id, type, text, context)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, type, text, context],
  );
  return result.rows[0];
}

export async function onTaskCompleted(
  taskId: string,
  taskText: string,
  listId: string,
  listName: string,
  actorId: string,
  actorName: string,
) {
  try {
    const listMembersResult = await query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM list_members WHERE list_id = $1`,
      [listId],
    );

    const memberIds = listMembersResult.rows.map((r) => r.user_id);
    if (memberIds.length === 0) return;

    for (const memberId of memberIds) {
      if (memberId === actorId) continue;
      const notif = await createNotification(
        memberId,
        'done',
        `${actorName} completed "${taskText}"`,
        listName,
      );
      if (io) {
        io.to(`user:${memberId}`).emit('notification:new', {
          notification: notif,
        });
      }
    }
  } catch (error) {
    console.error('Error in onTaskCompleted:', error);
  }
}

export async function onTaskAssigned(
  taskId: string,
  taskText: string,
  listId: string,
  listName: string,
  assigneeId: string,
  assigneeName: string,
  actorId: string,
  actorName: string,
) {
  try {
    if (assigneeId === actorId) return;

    const notif = await createNotification(
      assigneeId,
      'assign',
      `${actorName} assigned you "${taskText}"`,
      listName,
    );

    if (io) {
      io.to(`user:${assigneeId}`).emit('notification:new', {
        notification: notif,
      });
    }
  } catch (error) {
    console.error('Error in onTaskAssigned:', error);
  }
}

export async function onSublistCreated(
  sublistId: string,
  sublistName: string,
  listId: string,
  listName: string,
  creatorId: string,
  creatorName: string,
) {
  try {
    const listMembersResult = await query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM list_members WHERE list_id = $1`,
      [listId],
    );

    const memberIds = listMembersResult.rows.map((r) => r.user_id);

    for (const memberId of memberIds) {
      if (memberId === creatorId) continue;
      const notif = await createNotification(
        memberId,
        'create',
        `${creatorName} created the "${sublistName}" sublist`,
        listName,
      );
      if (io) {
        io.to(`user:${memberId}`).emit('notification:new', {
          notification: notif,
        });
      }
    }
  } catch (error) {
    console.error('Error in onSublistCreated:', error);
  }
}

export async function onMemberAdded(
  newUserId: string,
  newUserName: string,
  workspaceId: string,
  workspaceName: string,
) {
  try {
    const adminsResult = await query<{ user_id: string }>(
      `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role = 'admin'`,
      [workspaceId],
    );

    const adminIds = adminsResult.rows.map((r) => r.user_id);

    for (const adminId of adminIds) {
      const notif = await createNotification(
        adminId,
        'member',
        `${newUserName} joined the workspace`,
        workspaceName,
      );
      if (io) {
        io.to(`user:${adminId}`).emit('notification:new', {
          notification: notif,
        });
      }
    }
  } catch (error) {
    console.error('Error in onMemberAdded:', error);
  }
}

export async function onDueSoon(
  taskId: string,
  taskText: string,
  listId: string,
  listName: string,
  assigneeId: string,
) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existingResult = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'due' AND task_id = $2 AND created_at::date = $3::date`,
      [assigneeId, taskId, today],
    );

    if (existingResult.rowCount > 0) return;

    const notif = await createNotification(
      assigneeId,
      'due',
      `"${taskText}" is due tomorrow`,
      listName,
    );

    if (io) {
      io.to(`user:${assigneeId}`).emit('notification:new', {
        notification: notif,
      });
    }
  } catch (error) {
    console.error('Error in onDueSoon:', error);
  }
}
