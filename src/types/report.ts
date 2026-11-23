export type ReportStatus = "pending" | "reviewing" | "resolved" | "rejected";
export type ReportTarget = "product" | "company" | "message";

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ReportInput {
  target_type: ReportTarget;
  target_id: string;
  reason: string;
}
