import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../services/supabase/client";
import { createCompanyProfile } from "../services/auth/authService";
import { getCurrentCompany } from "../services/companies/companyService";
import { getSettings } from "../services/settings/settingsService";
import { setDarkMode } from "../hooks/useDarkMode";
import type { Company } from "../types/company";

interface AuthContextType {
  user: User | null;
  profile: Company | null;
  loading: boolean;
  accountBlocked: boolean;
  adminMfa: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Company | null) => void;
  clearSession: () => Promise<void>;
}

const AuthContext = createContext({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const [adminMfa, setAdminMfa] = useState(false);

  const clearSession = useCallback(async () => {
    localStorage.removeItem("rejet_pending_company");
    setProfile(null);
    setAccountBlocked(false);
    setAdminMfa(false);
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async (userId?: string) => {
    const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!id) {
      setProfile(null);
      setAccountBlocked(false);
      return;
    }

    const company = await getCurrentCompany(id).catch(() => null);

    if (!company) {
      const pending = localStorage.getItem("rejet_pending_company");
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as {
            id: string;
            company_name: string;
            cnpj: string;
            email?: string;
            phone?: string;
            city?: string;
            state?: string;
            segment?: string;
            description?: string;
          };
          if (parsed.id === id) {
            const error = await createCompanyProfile(id, { ...parsed, email: parsed.email ?? "" });
            if (!error) localStorage.removeItem("rejet_pending_company");
          }
        } catch {
          localStorage.removeItem("rejet_pending_company");
        }
      }
      const { data } = await supabase.auth.getUser();
      const account = data.user;
      if (account?.id === id && account.email) {
        const metadata = account.user_metadata;
        if (typeof metadata.company_name === "string" && typeof metadata.cnpj === "string") {
          const { company_name, cnpj, phone, city, state, segment, description } = metadata;
          await createCompanyProfile(id, {
            company_name,
            cnpj,
            email: account.email,
            phone: typeof phone === "string" ? phone : undefined,
            city: typeof city === "string" ? city : undefined,
            state: typeof state === "string" ? state : undefined,
            segment: typeof segment === "string" ? segment : undefined,
            description: typeof description === "string" ? description : undefined,
          });
        }
      }
    }

    const finalCompany = await getCurrentCompany(id).catch(() => null);
    if (finalCompany) localStorage.removeItem("rejet_pending_company");
    setProfile(finalCompany);
    setAccountBlocked(finalCompany ? !finalCompany.active : false);
  }, []);

  useEffect(() => {
    let active = true;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      clearTimeout(profileTimer);
      setUser(session?.user ?? null);
      const claims = session?.access_token.split(".")[1];
      try {
        setAdminMfa(!!claims && JSON.parse(atob(claims.replace(/-/g, "+").replace(/_/g, "/"))).aal === "aal2");
      } catch {
        setAdminMfa(false);
      }
      if (session?.user) {
        const id = session.user.id;
        profileTimer = setTimeout(() => {
          void refreshProfile(id).finally(() => {
            if (active) setLoading(false);
          });
        }, 0);
      } else {
        setProfile(null);
        setAccountBlocked(false);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(profileTimer);
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;

    getSettings(profile.id)
      .then((settings) => {
        if (active) setDarkMode(settings.dark_mode);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [profile?.id]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, accountBlocked, adminMfa, refreshProfile, setProfile, clearSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
