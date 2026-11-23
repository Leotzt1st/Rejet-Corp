import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../services/supabase/client";
import { Button, Card, Input } from "../ui";

export function AdminMfa() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadFactors() {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (!active) return;
        setFactorId(data.totp[0]?.id ?? null);
        setReady(true);
      } catch {
        if (active) setError("Não foi possível consultar seus fatores. Atualize a página para tentar novamente.");
      }
    }
    void loadFactors();
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      setSetup({ qr: result.data.totp.qr_code, secret: result.data.totp.secret });
    } catch {
      setError("Não foi possível configurar o autenticador. Confira se o TOTP está habilitado no Supabase.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      setCode("");
      setSetup(null);
    } catch {
      setError("Código inválido ou expirado. Use o código atual do autenticador.");
    } finally {
      setBusy(false);
    }
  }

  return <Card title="Confirme sua sessão administrativa">
    <p>A administração exige autenticação em dois fatores por aplicativo.</p>
    {error && <p role="alert">{error}</p>}
    {!ready && !error && <p role="status">Consultando autenticadores…</p>}
    {ready && !factorId && <Button onClick={() => void enable()} disabled={busy}>
      {busy ? "Configurando…" : "Configurar autenticador"}
    </Button>}
    {factorId && <form onSubmit={verify}>
      {setup && <div>
        <p>Escaneie o código com seu aplicativo ou copie a chave de configuração.</p>
        {setup.qr.startsWith("data:image/svg+xml") && <img src={setup.qr} width={176} height={176} alt="QR Code do autenticador" />}
        <p style={{ overflowWrap: "anywhere" }}><code translate="no">{setup.secret}</code></p>
      </div>}
      <Input label="Código de 6 dígitos" name="mfa-code" inputMode="numeric" autoComplete="one-time-code"
        spellCheck={false} required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.trim())} />
      <Button type="submit" disabled={busy}>{busy ? "Confirmando…" : "Confirmar código"}</Button>
    </form>}
  </Card>;
}
