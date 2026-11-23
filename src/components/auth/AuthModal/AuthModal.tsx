import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  FiUser,
  FiLock,
  FiMail,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { BsBuildings } from "react-icons/bs";
import { HiOutlineDocumentText } from "react-icons/hi2";

import styles from "./AuthModal.module.css";

import { resetPassword, signIn, signUp } from "../../../services/auth/authService";
import { useToast } from "../../ui";
import { formatCNPJInput, isValidCNPJ } from "../../../utils/cnpj";

interface Props {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  mode?: "login" | "register";
}

type View = "login" | "register" | "forgot";

export default function AuthModal({ open, onClose, onAuthenticated, mode = "login" }: Props) {
  const { success, info } = useToast();

  const [view, setView] = useState<View>(mode === "register" ? "register" : "login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    if (open) {
      setView(mode === "register" ? "register" : "login");
      setShowLoginPassword(false);
      setFormError(null);
      setSent(false);
    }
  }, [open, mode]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!loginEmail || !loginPassword) {
      setFormError("Preencha e-mail e senha.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signInError } = await signIn(loginEmail, loginPassword);

      if (signInError) {
        setFormError(messageForError(signInError.message));
        return;
      }

      if (!data.user) {
        setFormError("Não foi possível autenticar. Tente novamente.");
        return;
      }

      success("Login realizado com sucesso!");
      setLoginEmail("");
      setLoginPassword("");
      onAuthenticated();
    } catch {
      setFormError("Erro inesperado ao fazer login. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    if (!companyName.trim() || !cnpjLimpo || !registerEmail || !registerPassword) {
      setFormError("Preencha todos os campos.");
      return;
    }
    if (!isValidCNPJ(cnpjLimpo)) {
      setFormError("CNPJ inválido. Verifique os dígitos.");
      return;
    }
    if (registerPassword.length < 8) {
      setFormError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setFormError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: signUpError, profileCreated } = await signUp({
        company_name: companyName.trim(),
        cnpj: cnpjLimpo,
        email: registerEmail,
        password: registerPassword,
      });

      if (signUpError) {
        setFormError(messageForError(signUpError.message));
        return;
      }

      if (profileCreated) {
        success("Cadastro realizado com sucesso!");
        setCompanyName("");
        setCnpj("");
        setRegisterEmail("");
        setRegisterPassword("");
        setConfirmPassword("");
        setView("login");
        onAuthenticated();
      } else {
        info("Cadastro criado! Verifique seu e-mail para confirmar e ativar a conta.");
      }
    } catch {
      setFormError("Erro inesperado ao registrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!forgotEmail) {
      setFormError("Informe seu e-mail corporativo.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: resetError } = await resetPassword(forgotEmail);
      if (resetError) {
        setFormError("Falha ao enviar o link: " + resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setFormError("Erro inesperado ao enviar o link.");
    } finally {
      setSubmitting(false);
    }
  }

  function messageForError(raw: string) {
    const lower = raw.toLowerCase();
    if (lower.includes("invalid login credentials")) {
      return "E-mail ou senha incorretos.";
    }
    if (lower.includes("already registered")) {
      return "Este e-mail já está cadastrado.";
    }
    if (lower.includes("password should be")) {
      return "A senha deve ter pelo menos 8 caracteres.";
    }
    if (lower.includes("rate limit") || lower.includes("too many")) {
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }
    if (lower.includes("email not confirmed")) {
      return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
    }
    if (lower.includes("user not found")) {
      return "Nenhuma conta encontrada para este e-mail.";
    }
    return raw;
  }

  function switchView(next: View) {
    setFormError(null);
    setSent(false);
    setShowLoginPassword(false);
    setView(next);
  }

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
        <button ref={closeButtonRef} className={styles.close} onClick={onClose} type="button" aria-label="Fechar">
          <FiX aria-hidden="true" />
        </button>

        <div className={styles.header}>
          <h2 id="auth-title">
            {view === "login" && "Entrar na plataforma"}
            {view === "register" && "Registrar empresa"}
            {view === "forgot" && "Recuperar senha"}
          </h2>

          <p id="auth-description">
            {view === "login" && "Use seu acesso corporativo para entrar no sistema."}
            {view === "register" && (
              <>Cadastre sua empresa na <span translate="no">Rejet Corp</span>.</>
            )}
            {view === "forgot" && "Enviaremos um link de redefinição para o seu e-mail."}
          </p>
        </div>

        {formError && (
          <div className={styles.formError} role="alert">
            <FiAlertCircle />
            <span>{formError}</span>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin}>
            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="login-email">E-mail corporativo</label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="E-mail corporativo"
                autoComplete="email"
                spellCheck={false}
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
              <FiUser aria-hidden="true" />
            </div>

            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                className={styles.passwordInput}
                name="password"
                type={showLoginPassword ? "text" : "password"}
                placeholder="Senha"
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-controls="login-password"
                onClick={() => setShowLoginPassword((visible) => !visible)}
              >
                {showLoginPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>

            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? "Entrando..." : "Entrar"}
            </button>

            <div className={styles.forgot}>
              <button type="button" onClick={() => switchView("forgot")}>Esqueci minha senha</button>
            </div>

            <div className={styles.switch}>
              <p>
                Não possui conta?{" "}
                <button type="button" onClick={() => switchView("register")}>Registrar-se</button>
              </p>
            </div>
          </form>
        )}

        {view === "register" && (
          <form onSubmit={handleRegister}>
            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="register-company">Nome da empresa</label>
              <input
                id="register-company"
                name="organization"
                placeholder="Nome da empresa"
                autoComplete="organization"
                required
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <BsBuildings aria-hidden="true" />
            </div>

            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="register-cnpj">CNPJ</label>
              <input
                id="register-cnpj"
                name="cnpj"
                placeholder="CNPJ"
                inputMode="numeric"
                required
                value={cnpj}
                onChange={(event) => setCnpj(formatCNPJInput(event.target.value))}
              />
              <HiOutlineDocumentText aria-hidden="true" />
            </div>
            <p className={styles.fieldNote}>O CNPJ identifica sua empresa no cadastro corporativo.</p>

            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="register-email">E-mail corporativo</label>
              <input
                id="register-email"
                name="email"
                type="email"
                placeholder="E-mail corporativo"
                autoComplete="email"
                spellCheck={false}
                required
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
              <FiMail aria-hidden="true" />
            </div>

            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="register-password">Senha, mínimo 8 caracteres</label>
              <input
                id="register-password"
                name="new-password"
                type="password"
                placeholder="Senha (mín. 8 caracteres)"
                autoComplete="new-password"
                minLength={8}
                required
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
              <FiLock aria-hidden="true" />
            </div>

            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="confirm-password">Confirmar senha</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                placeholder="Confirmar senha"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <FiLock aria-hidden="true" />
            </div>

            <p className={styles.privacyNotice}>
              Consulte o <a href="/informacoes#privacidade">uso dos dados</a> e a
              <a href="/informacoes#termos"> situação atual dos termos</a> antes do cadastro.
            </p>

            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? "Registrando..." : "Registrar Empresa"}
            </button>

            <div className={styles.switch}>
              <p>
                Já possui conta?{" "}
              <button type="button" onClick={() => switchView("login")}>Entrar</button>
              </p>
            </div>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={handleForgot}>
            <div className={styles.input}>
              <label className={styles.visuallyHidden} htmlFor="forgot-email">E-mail corporativo</label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                placeholder="E-mail corporativo"
                autoComplete="email"
                spellCheck={false}
                required
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
              />
              <FiMail aria-hidden="true" />
            </div>

            {sent ? (
              <div className={styles.sentBox}>
                <FiCheckCircle />
                <span>
                  Link enviado! Verifique sua caixa de entrada (e o spam) para redefinir a senha.
                </span>
              </div>
            ) : (
              <button className={styles.button} disabled={submitting} type="submit">
                {submitting ? "Enviando..." : "Enviar link"}
              </button>
            )}

            <div className={styles.switch}>
              <p>
                Lembrou a senha?{" "}
              <button type="button" onClick={() => switchView("login")}>Entrar</button>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
