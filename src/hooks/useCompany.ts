import { useCallback, useEffect, useState } from "react";
import { getCompany } from "../services/companies/companyService";

export function useCompany(id: string | undefined) {
  const [company, setCompany] = useState<Awaited<ReturnType<typeof getCompany>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) {
      setCompany(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getCompany(id);
      setCompany(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar empresa.");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { company, loading, error, refresh, setCompany };
}
