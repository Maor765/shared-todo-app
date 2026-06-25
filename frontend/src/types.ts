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

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  role: 'admin' | 'member';
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
  workspace: { id: string; name: string };
  pendingInvite?: WorkspaceInvite | null;
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
  tasks?: DBTask[];
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
  amount: number | null;
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
