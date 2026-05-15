export interface PublicUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  text_color: string;
  role: 'admin' | 'member';
  status: 'active' | 'away';
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
  workspace: { id: string; name: string };
}

export interface DBUser extends PublicUser {
  password_hash: string;
  created_at: string;
}

export interface DBWorkspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface DBList {
  id: string;
  workspace_id: string;
  name: string;
  emoji: string;
  shared: boolean;
  created_by: string;
  created_at: string;
}

export interface ListWithMembers extends DBList {
  members: PublicUser[];
}

export interface DBSublist {
  id: string;
  list_id: string;
  name: string;
  created_at: string;
}

export interface DBTask {
  id: string;
  list_id: string;
  sublist_id: string | null;
  text: string;
  done: boolean;
  assignee_id: string | null;
  due: string | null;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ListDetail extends ListWithMembers {
  sublists: DBSublist[];
  tasks: DBTask[];
}

export interface DBNotification {
  id: string;
  user_id: string;
  type: 'done' | 'assign' | 'due' | 'member' | 'create';
  text: string;
  context: string;
  read: boolean;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  role: 'admin' | 'member';
}

export interface JWTPayload {
  sub: string;
  workspace_id: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
}

export interface TaskCreatedPayload {
  task: DBTask;
  list_id: string;
}

export interface TaskUpdatedPayload {
  task: DBTask;
  list_id: string;
}

export interface TaskDeletedPayload {
  task_id: string;
  list_id: string;
}

export interface SublistCreatedPayload {
  sublist: DBSublist;
  list_id: string;
}

export interface SublistDeletedPayload {
  sublist_id: string;
  list_id: string;
}

export interface NotificationPayload {
  notification: DBNotification;
}

export interface MemberStatusPayload {
  user_id: string;
  status: 'active' | 'away';
}
