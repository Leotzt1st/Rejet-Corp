export interface UserSettings {
  user_id: string;
  dark_mode: boolean;
  language: string;
  notify_messages: boolean;
  notify_interests: boolean;
  notify_negotiations: boolean;
  notify_news: boolean;
  privacy_profile: boolean;
  updated_at: string;
}

export type UserSettingsInput = Partial<
  Omit<UserSettings, "user_id" | "updated_at">
>;
