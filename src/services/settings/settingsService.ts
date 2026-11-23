import { supabase } from "../supabase/client";
import type { UserSettings, UserSettingsInput } from "../../types/settings";

export async function getSettings(userId: string) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const defaults: UserSettings = {
      user_id: userId,
      dark_mode: false,
      language: "pt-BR",
      notify_messages: true,
      notify_interests: true,
      notify_negotiations: true,
      notify_news: false,
      privacy_profile: true,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("user_settings").upsert(defaults);
    return defaults;
  }

  return data as UserSettings;
}

export async function saveSettings(userId: string, input: UserSettingsInput) {
  const { error } = await supabase
    .from("user_settings")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw error;
}
