import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import Navbar from "../../../components/layout/Navbar";
import Hero from "../../../components/home/Hero";
import About from "../../../components/home/About";
import Ecosystem from "../../../components/home/Ecosystem/Ecosystem";
import Footer from "../../../components/layout/Footer";
import AuthModal from "../../../components/auth/AuthModal/AuthModal";
import { supabaseConfigured } from "../../../services/supabase/client";
import styles from "./LoginPage.module.css";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [modalMode, setModalMode] = useState<AuthMode | null>(null);
  const [aboutVisit, setAboutVisit] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const loginRequested = params.get("entrar") === "1";

  function openModal(mode: AuthMode) {
    if (!supabaseConfigured) return;
    setModalMode(mode);
  }

  function closeModal() {
    setModalMode(null);
    if (!loginRequested) return;
    const next = new URLSearchParams(params);
    next.delete("entrar");
    setParams(next, { replace: true, state: location.state });
  }

  function onAuthenticated() {
    const target = location.state?.returnTo;
    const path = target?.pathname;
    if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) {
      navigate({ pathname: path, search: target.search, hash: target.hash }, { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>

      <div className={styles.opening} id="inicio">
        <Navbar
          authDisabled={!supabaseConfigured}
          onRegister={() => openModal("register")}
          onLogin={() => openModal("login")}
          onAboutNavigate={() => setAboutVisit((count) => count + 1)}
        />
        <main id="conteudo" tabIndex={-1}>
          <Hero
            onRegister={() => openModal("register")}
            demoMode={!supabaseConfigured}
          />
          <div className={styles.lower}>
            <div className={styles.lowerInner}>
              {!supabaseConfigured && (
                <p className={styles.previewNotice} role="status">
                  Prévia visual. Conecte o Supabase para habilitar login e cadastro.
                </p>
              )}
              <About visit={aboutVisit} />
            </div>
          </div>
          <Ecosystem onAccess={() => openModal("login")} disabled={!supabaseConfigured} />
        </main>
      </div>

      <Footer />

      <AuthModal
        open={supabaseConfigured && (modalMode !== null || loginRequested)}
        mode={modalMode ?? "login"}
        onClose={closeModal}
        onAuthenticated={onAuthenticated}
      />
    </>
  );
}
