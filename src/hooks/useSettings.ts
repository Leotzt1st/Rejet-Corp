import { useCallback, useEffect, useState } from "react";
import { getSettings, saveSettings } from "../services/settings/settingsService";
import type { UserSettings, UserSettingsInput } from "../types/settings";
import { useAuth } from "../contexts/AuthContext";

export function useSettings() {
  const { user, profile } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getSettings(userId);
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: UserSettingsInput) => {
      if (!userId) return false;
      setSaving(true);
      try {
        await saveSettings(userId, input);
        setSettings((current) => (current ? { ...current, ...input } : current));
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  return { settings, loading, saving, save, refresh };
}
