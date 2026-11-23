import { useEffect, useState, type FormEvent } from "react";
import { FiArrowLeft, FiKey, FiMail, FiLock } from "react-icons/fi";
import { Link } from "react-router-dom";
import { supabase } from "../../../services/supabase/client";
import { resetPassword, updatePassword } from "../../../services/auth/authService";
import styles from "./ResetPasswordPage.module.css";

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("set");
        setMessage(null);
        setError(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Informe seu e-mail corporativo.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError("Falha ao enviar o link: " + resetError.message);
      } else {
        setMessage(
          "Enviamos um link de redefinição para o seu e-mail. Verifique sua caixa de entrada."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSet(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError("Falha ao atualizar a senha: " + updateError.message);
      } else {
        setMessage("Senha atualizada com sucesso! Você já pode entrar com a nova senha.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}><FiKey aria-hidden="true" /></span>

        <h1>Redefinir senha</h1>

        {mode === "request" ? (
          <>
            <p className={styles.subtitle}>
              Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
            </p>

            <form onSubmit={handleRequest} className={styles.form}>
              <label className={styles.field}>
                <span>E-mail corporativo</span>
                <div className={styles.inputWrap}>
                  <FiMail />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="voce@empresa.com.br"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </label>

              {error && <p className={styles.error} role="alert">{error}</p>}
              {message && <p className={styles.message} role="status">{message}</p>}

              <button className={styles.button} disabled={submitting} type="submit">
                {submitting ? "Enviando…" : "Enviar link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>
              Defina uma nova senha para a sua conta.
            </p>

            <form onSubmit={handleSet} className={styles.form}>
              <label className={styles.field}>
                <span>Nova senha</span>
                <div className={styles.inputWrap}>
                  <FiLock />
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Confirmar nova senha</span>
                <div className={styles.inputWrap}>
                  <FiLock />
                  <input
                    type="password"
                    name="confirm_password"
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
              </label>

              {error && <p className={styles.error} role="alert">{error}</p>}
              {message && <p className={styles.message} role="status">{message}</p>}

              <button className={styles.button} disabled={submitting} type="submit">
                {submitting ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
          </>
        )}

        <Link to="/?entrar=1" className={styles.back}>
          <FiArrowLeft /> Voltar para o login
        </Link>
      </div>
    </div>
  );
}
