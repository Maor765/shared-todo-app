import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { PublicUser, AuthResponse } from '../types.js';

const googleOAuthClient = new OAuth2Client();

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
    { expiresIn: '180d' },
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

    // Check for a pending invite — auto-accept so the user lands directly in the shared workspace
    const inviteResult = await query(
      `SELECT wi.id, wi.role, w.id as workspace_id, w.name as workspace_name
       FROM workspace_invites wi
       JOIN workspaces w ON w.id = wi.workspace_id
       WHERE LOWER(wi.email) = $1
       LIMIT 1`,
      [email],
    );

    if (inviteResult.rowCount > 0) {
      const invite = inviteResult.rows[0];
      // Add to the inviting workspace
      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [invite.workspace_id, userId, invite.role],
      );
      // Clean up the invite
      await query(`DELETE FROM workspace_invites WHERE id = $1`, [invite.id]);
      // Delete the just-created empty own workspace
      await query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
      await query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
      // Issue token for the shared workspace
      const sharedToken = signToken(userId, invite.workspace_id, invite.role);
      res.status(201).json({ token: sharedToken, user: toPublicUser(user), workspace: { id: invite.workspace_id, name: invite.workspace_name } });
      return;
    }

    const token = signToken(userId, workspaceId, 'admin');
    res.status(201).json({ token, user: toPublicUser(user), workspace: { id: workspaceId, name: workspace.name } });
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

    if (!user.password_hash) {
      throw new AppError(401, 'Invalid credentials');
    }

    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError(401, 'Invalid credentials');
    }

    const workspaceResult = await query(
      `SELECT workspaces.id, workspaces.name, workspace_members.role as ws_role
       FROM workspace_members
       JOIN workspaces ON workspaces.id = workspace_members.workspace_id
       WHERE workspace_members.user_id = $1
       ORDER BY (workspaces.owner_id = $1) DESC
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
      user: toPublicUser({ ...user, role: workspace.ws_role }),
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

    // If the user's own workspace is empty, remove them from it so login lands here
    const ownWs = await query(
      `SELECT w.id FROM workspaces w WHERE w.owner_id = $1
       AND (SELECT COUNT(*) FROM lists WHERE workspace_id = w.id) = 0`,
      [userId],
    );
    if (ownWs.rowCount > 0) {
      const ownId = ownWs.rows[0].id;
      await query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [ownId, userId]);
      await query(`DELETE FROM workspaces WHERE id = $1`, [ownId]);
    }

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

    const result = await query(
      `SELECT u.id, u.email, u.name, u.initials, u.color, u.text_color, u.status,
              wm.role as ws_role, w.id as ws_id, w.name as ws_name
       FROM users u
       JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $2
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE u.id = $1`,
      [userId, workspaceId],
    );

    if (result.rowCount === 0) {
      throw new AppError(401, 'Not a member of this workspace');
    }

    const row = result.rows[0];
    res.json({
      user: toPublicUser({ ...row, role: row.ws_role }),
      workspace: { id: row.ws_id, name: row.ws_name },
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) throw new AppError(400, 'Email required');

    const userResult = await query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );

    // Always respond the same way to prevent email enumeration
    if (userResult.rowCount === 0) {
      res.json({ resetLink: null });
      return;
    }

    const userId = userResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt],
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    res.json({ resetLink });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError(400, 'Token and password required');
    if (password.length < 6) throw new AppError(400, 'Password must be at least 6 characters');

    const tokenResult = await query(
      `SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()`,
      [token],
    );

    if (tokenResult.rowCount === 0) throw new AppError(400, 'Invalid or expired reset link');

    const userId = tokenResult.rows[0].user_id;
    const passwordHash = await bcryptjs.hash(password, 12);

    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
    await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { credential } = req.body;
    if (!credential) throw new AppError(400, 'Missing credential');

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) throw new AppError(500, 'Google auth not configured');

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new AppError(401, 'Invalid Google token');

    const { sub: googleId, email: rawEmail, name: googleName } = payload;
    if (!rawEmail) throw new AppError(400, 'Google account has no email');

    const email = rawEmail.toLowerCase();
    const name = googleName || email.split('@')[0];

    // Case 1: returning Google user matched by google_id
    let userResult = await query(
      `SELECT id, email, name, initials, color, text_color, role, status
       FROM users WHERE google_id = $1`,
      [googleId],
    );

    if (userResult.rowCount === 0) {
      const emailResult = await query(
        `SELECT id, email, name, initials, color, text_color, role, status
         FROM users WHERE email = $1`,
        [email],
      );

      if (emailResult.rowCount > 0) {
        // Case 2: email matches existing account — auto-link
        await query(`UPDATE users SET google_id = $1 WHERE email = $2`, [googleId, email]);
        userResult = emailResult;
      } else {
        // Case 3: brand new user
        const userCountResult = await query(`SELECT COUNT(*) as count FROM users`);
        const userCount = parseInt(userCountResult.rows[0].count, 10);
        const { color, text_color } = getAvatarColor(userCount);
        const initials = getInitials(name);

        const newUserResult = await query(
          `INSERT INTO users (email, password_hash, name, initials, color, text_color, role, status, google_id)
           VALUES ($1, NULL, $2, $3, $4, $5, 'member', 'active', $6)
           RETURNING id, email, name, initials, color, text_color, role, status`,
          [email, name, initials, color, text_color, googleId],
        );

        const user = newUserResult.rows[0];
        const userId = user.id;
        const workspaceName = `${name}'s Workspace`;

        const workspaceResult = await query(
          `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name`,
          [workspaceName, userId],
        );
        const newWorkspace = workspaceResult.rows[0];
        const workspaceId = newWorkspace.id;

        await query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
          [workspaceId, userId],
        );

        // Honour a pending invite (same logic as register())
        const inviteResult = await query(
          `SELECT wi.id, wi.role, w.id as workspace_id, w.name as workspace_name
           FROM workspace_invites wi
           JOIN workspaces w ON w.id = wi.workspace_id
           WHERE LOWER(wi.email) = $1 LIMIT 1`,
          [email],
        );

        if (inviteResult.rowCount > 0) {
          const invite = inviteResult.rows[0];
          await query(
            `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [invite.workspace_id, userId, invite.role],
          );
          await query(`DELETE FROM workspace_invites WHERE id = $1`, [invite.id]);
          await query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
          await query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
          const sharedToken = signToken(userId, invite.workspace_id, invite.role);
          res.status(201).json({
            token: sharedToken,
            user: toPublicUser(user),
            workspace: { id: invite.workspace_id, name: invite.workspace_name },
          });
          return;
        }

        const token = signToken(userId, workspaceId, 'admin');
        res.status(201).json({
          token,
          user: toPublicUser(user),
          workspace: { id: workspaceId, name: workspaceName },
        });
        return;
      }
    }

    // Existing user (Case 1 or auto-linked Case 2) — look up their workspace
    const user = userResult.rows[0];
    const workspaceResult = await query(
      `SELECT workspaces.id, workspaces.name, workspace_members.role as ws_role
       FROM workspace_members
       JOIN workspaces ON workspaces.id = workspace_members.workspace_id
       WHERE workspace_members.user_id = $1
       ORDER BY (workspaces.owner_id = $1) DESC
       LIMIT 1`,
      [user.id],
    );

    if (workspaceResult.rowCount === 0) throw new AppError(500, 'User workspace not found');

    const workspace = workspaceResult.rows[0];
    const token = signToken(user.id, workspace.id, workspace.ws_role);
    res.json({
      token,
      user: toPublicUser({ ...user, role: workspace.ws_role }),
      workspace: { id: workspace.id, name: workspace.name },
    });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    // google-auth-library throws on invalid/expired tokens — never expose its internals
    next(new AppError(401, 'Invalid Google token'));
  }
}
