import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { PublicUser, AuthResponse } from '../types.js';

const AVATAR_PALETTE = [
  { color: '#B5D4F4', text_color: '#0C447C' },
  { color: '#9FE1CB', text_color: '#085041' },
  { color: '#F4C0D1', text_color: '#72243E' },
  { color: '#FAC775', text_color: '#633806' },
  { color: '#C7B8EA', text_color: '#3D1E7A' },
  { color: '#F4D4A0', text_color: '#6B3E10' },
  { color: '#B8E8E0', text_color: '#0D5048' },
  { color: '#F0B8B8', text_color: '#6B1A1A' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(userCount: number) {
  return AVATAR_PALETTE[userCount % AVATAR_PALETTE.length];
}

function signToken(userId: string, workspaceId: string, role: string): string {
  return jwt.sign(
    { sub: userId, workspace_id: workspaceId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' },
  );
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

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email: rawEmail, password, name, workspace_name } = req.body;
    const email = rawEmail?.toLowerCase();

    if (!email || !password || !name) {
      throw new AppError(400, 'Missing required fields');
    }

    const resolvedWorkspaceName = workspace_name || `${name}'s Workspace`;

    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    );

    if (existingUser.rowCount > 0) {
      throw new AppError(409, 'Email already in use');
    }

    const userCountResult = await query(`SELECT COUNT(*) as count FROM users`);
    const userCount = parseInt(userCountResult.rows[0].count, 10);
    const { color, text_color } = getAvatarColor(userCount);
    const initials = getInitials(name);
    const passwordHash = await bcryptjs.hash(password, 12);

    const userResult = await query(
      `INSERT INTO users (email, password_hash, name, initials, color, text_color, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, initials, color, text_color, role, status`,
      [
        email,
        passwordHash,
        name,
        initials,
        color,
        text_color,
        'member',
        'active',
      ],
    );

    const user = userResult.rows[0];
    const userId = user.id;

    const workspaceResult = await query(
      `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name`,
      [resolvedWorkspaceName, userId],
    );

    const workspace = workspaceResult.rows[0];
    const workspaceId = workspace.id;

    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
      [workspaceId, userId, 'admin'],
    );

    const token = signToken(userId, workspaceId, 'admin');

    const inviteResult = await query(
      `SELECT wi.id, wi.role, w.id as workspace_id, w.name as workspace_name
       FROM workspace_invites wi
       JOIN workspaces w ON w.id = wi.workspace_id
       WHERE LOWER(wi.email) = $1
       LIMIT 1`,
      [email],
    );

    const pendingInvite = inviteResult.rowCount > 0 ? {
      id: inviteResult.rows[0].id,
      workspace_id: inviteResult.rows[0].workspace_id,
      workspace_name: inviteResult.rows[0].workspace_name,
      role: inviteResult.rows[0].role,
    } : null;

    res.status(201).json({ token, user: toPublicUser(user), workspace: { id: workspaceId, name: workspace.name }, pendingInvite });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.toLowerCase();

    if (!email || !password) {
      throw new AppError(400, 'Email and password required');
    }

    const userResult = await query(
      `SELECT id, email, password_hash, name, initials, color, text_color, role, status
       FROM users WHERE email = $1`,
      [email],
    );

    if (userResult.rowCount === 0) {
      throw new AppError(401, 'Invalid credentials');
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError(401, 'Invalid credentials');
    }

    const workspaceResult = await query(
      `SELECT workspaces.id, workspaces.name, workspace_members.role as ws_role
       FROM workspace_members
       JOIN workspaces ON workspaces.id = workspace_members.workspace_id
       WHERE workspace_members.user_id = $1
       LIMIT 1`,
      [user.id],
    );

    if (workspaceResult.rowCount === 0) {
      throw new AppError(500, 'User workspace not found');
    }

    const workspace = workspaceResult.rows[0];
    const token = signToken(user.id, workspace.id, workspace.ws_role);

    const response: AuthResponse = {
      token,
      user: toPublicUser(user),
      workspace: { id: workspace.id, name: workspace.name },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function acceptInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { inviteId } = req.params;
    const userId = req.user?.sub;

    if (!userId) throw new AppError(401, 'Unauthorized');

    const inviteResult = await query(
      `SELECT wi.id, wi.workspace_id, wi.email, wi.role, w.name as workspace_name
       FROM workspace_invites wi
       JOIN workspaces w ON w.id = wi.workspace_id
       WHERE wi.id = $1`,
      [inviteId],
    );

    if (inviteResult.rowCount === 0) throw new AppError(404, 'Invite not found');

    const invite = inviteResult.rows[0];

    const userResult = await query(
      `SELECT id, email, name, initials, color, text_color, role, status FROM users WHERE id = $1`,
      [userId],
    );
    if (userResult.rows[0].email.toLowerCase() !== invite.email.toLowerCase()) throw new AppError(403, 'Invite not for this account');

    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [invite.workspace_id, userId, invite.role],
    );

    await query(`DELETE FROM workspace_invites WHERE id = $1`, [inviteId]);

    const token = signToken(userId, invite.workspace_id, invite.role);

    res.json({
      token,
      user: toPublicUser(userResult.rows[0]),
      workspace: { id: invite.workspace_id, name: invite.workspace_name },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    const workspaceId = req.user?.workspace_id;

    if (!userId || !workspaceId) {
      throw new AppError(401, 'Unauthorized');
    }

    const userResult = await query(
      `SELECT id, email, name, initials, color, text_color, role, status FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rowCount === 0) {
      throw new AppError(404, 'User not found');
    }

    const workspaceResult = await query(
      `SELECT id, name FROM workspaces WHERE id = $1`,
      [workspaceId],
    );

    if (workspaceResult.rowCount === 0) {
      throw new AppError(404, 'Workspace not found');
    }

    res.json({
      user: toPublicUser(userResult.rows[0]),
      workspace: workspaceResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
}
