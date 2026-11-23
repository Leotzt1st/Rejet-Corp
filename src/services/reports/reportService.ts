import { supabase } from "../supabase/client";
import type { Report, ReportInput, ReportStatus } from "../../types/report";

export async function createReport(userId: string, input: ReportInput) {
  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: userId,
      target_type: input.target_type,
      target_id: input.target_id,
      reason: input.reason,
      status: "pending",
    });

  if (error) throw new Error(error.message);
}

export async function listReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Report[];
}

export async function updateReportStatus(id: string, status: ReportStatus) {
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw error;
}
