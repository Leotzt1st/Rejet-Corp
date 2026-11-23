export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface ActivityLogInput {
  action: string;
  details?: string;
}
