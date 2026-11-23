import { useEffect, useState } from "react";

import styles from "./ConfigPage.module.css";

import { Button, Card, Input, Switch } from "../../components/ui";
import { useSettings } from "../../hooks/useSettings";
import { setDarkMode as applyDarkMode } from "../../hooks/useDarkMode";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { signOut, updatePassword, updateEmail } from "../../services/auth/authService";
import { useNavigate } from "react-router-dom";

type Tab = "conta" | "aparencia" | "notificacoes" | "preferencias";

const TABS: { key: Tab; label: string }[] = [
  { key: "conta", label: "Conta" },
  { key: "aparencia", label: "Aparência" },
  { key: "notificacoes", label: "Notificações" },
  { key: "preferencias", label: "Preferências" },
];

export default function ConfigPage() {
  const { profile, user } = useAuth();
  const { settings, loading, saving, save } = useSettings();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("conta");
  const [darkMode, setDarkMode] = useState(false);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyInterests, setNotifyInterests] = useState(true);
  const [notifyNegotiations, setNotifyNegotiations] = useState(true);
  const [notifyNews, setNotifyNews] = useState(false);
  const [privacyProfile, setPrivacyProfile] = useState(true);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDarkMode(settings.dark_mode);
    setNotifyMessages(settings.notify_messages);
    setNotifyInterests(settings.notify_interests);
    setNotifyNegotiations(settings.notify_negotiations);
    setNotifyNews(settings.notify_news);
    setPrivacyProfile(settings.privacy_profile);
  }, [settings]);

  async function saveAppearance() {
    const ok = await save({ dark_mode: darkMode });
    if (ok) {
      applyDarkMode(darkMode);
      success("Aparência salva.");
    } else error("Falha ao salvar aparência.");
  }

  async function saveNotifications() {
    const ok = await save({
      notify_messages: notifyMessages,
      notify_interests: notifyInterests,
      notify_negotiations: notifyNegotiations,
      notify_news: notifyNews,
    });
    if (ok) success("Preferências de notificação salvas.");
    else error("Falha ao salvar notificações.");
  }

  async function savePreferences() {
    const ok = await save({ privacy_profile: privacyProfile });
    if (ok) success("Preferências salvas.");
    else error("Falha ao salvar preferências.");
  }

  async function handleUpdateEmail() {
    if (!newEmail.trim()) {
      error("Informe o novo e-mail.");
      return;
    }
    setUpdating(true);
    try {
      const { error: updateError } = await updateEmail(newEmail.trim());
      if (updateError) throw updateError;
      success("E-mail atualizado. Verifique sua caixa de entrada.");
      setNewEmail("");
    } catch {
      error("Falha ao atualizar o e-mail.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setUpdating(true);
    try {
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) throw updateError;
      success("Senha atualizada!");
      setNewPassword("");
    } catch {
      error("Falha ao atualizar a senha.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Preferências da conta</h2>
        <p className={styles.subtitle}>Personalize sua conta e preferências.</p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.tabs} aria-label="Categorias de configuração">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={tab === item.key}
              className={`${styles.tab} ${tab === item.key ? styles.tabActive : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {tab === "conta" && (
            <>
              <Card title="Informações da conta">
                <div className={styles.infoRow}>
                  <span>Empresa</span>
                  <strong>{profile?.company_name ?? "—"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>E-mail</span>
                  <strong>{profile?.email ?? user?.email ?? "—"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>CNPJ</span>
                  <strong>{profile?.cnpj ?? "—"}</strong>
                </div>
              </Card>

              <Card title="Alterar e-mail">
                <Input
                  label="Novo e-mail"
                  name="email"
                  type="email"
                  placeholder="novo@empresa.com.br"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
                <Button onClick={handleUpdateEmail} disabled={updating}>
                  Atualizar e-mail
                </Button>
              </Card>

              <Card title="Alterar senha">
                <Input
                  label="Nova senha"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <Button onClick={handleUpdatePassword} disabled={updating}>
                  Atualizar senha
                </Button>
              </Card>

              <Card title="Sessão" className={styles.dangerCard}>
                <p className={styles.dangerText}>
                  Encerrar a sessão atual em todos os dispositivos.
                </p>
                <Button variant="danger" onClick={handleLogout}>
                  Sair da conta
                </Button>
              </Card>

              <Card title="Privacidade e dados">
                <p className={styles.privacyText}>
                  Consulte como os dados são usados ou solicite acesso, correção ou exclusão.
                </p>
                <div className={styles.privacyLinks}>
                  <a href="/informacoes#privacidade">Ver informações de privacidade</a>
                  <a href="mailto:contato@rejet.com?subject=Solicita%C3%A7%C3%A3o%20de%20dados%20pessoais%20-%20Rejet%20Corp">
                    Enviar solicitação por e-mail
                  </a>
                </div>
              </Card>
            </>
          )}

          {tab === "aparencia" && (
            <Card title="Aparência">
              {loading ? (
                <p className={styles.loading}>Carregando preferências...</p>
              ) : (
                <>
                  <div className={styles.switchRow}>
                    <Switch
                      label="Modo escuro"
                      checked={darkMode}
                      onChange={(event) => setDarkMode(event.target.checked)}
                    />
                  </div>
                  <div className={styles.saveRow}>
                    <Button onClick={saveAppearance} disabled={saving}>
                      Salvar aparência
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "notificacoes" && (
            <Card title="Notificações">
              {loading ? (
                <p className={styles.loading}>Carregando preferências...</p>
              ) : (
                <>
                  <div className={styles.switchList}>
                    <Switch
                      label="Novas mensagens"
                      checked={notifyMessages}
                      onChange={(event) => setNotifyMessages(event.target.checked)}
                    />
                    <Switch
                      label="Novos interesses nos meus produtos"
                      checked={notifyInterests}
                      onChange={(event) => setNotifyInterests(event.target.checked)}
                    />
                    <Switch
                      label="Atualizações de negociação"
                      checked={notifyNegotiations}
                      onChange={(event) => setNotifyNegotiations(event.target.checked)}
                    />
                    <Switch
                      label="Novidades e comunicados"
                      checked={notifyNews}
                      onChange={(event) => setNotifyNews(event.target.checked)}
                    />
                  </div>
                  <div className={styles.saveRow}>
                    <Button onClick={saveNotifications} disabled={saving}>
                      Salvar notificações
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "preferencias" && (
            <Card title="Preferências">
              {loading ? (
                <p className={styles.loading}>Carregando preferências...</p>
              ) : (
                <>
                  <div className={styles.switchRow}>
                    <Switch
                      label="Perfil e anúncios visíveis para outras empresas"
                      checked={privacyProfile}
                      onChange={(event) => setPrivacyProfile(event.target.checked)}
                    />
                  </div>
                  <p className={styles.switchHint}>
                    Ao ocultar, outras empresas deixam de ver seu perfil e seus anúncios.
                    Links temporários de arquivos emitidos antes da alteração podem funcionar
                    por até cinco minutos.
                  </p>

                  <div className={styles.saveRow}>
                    <Button onClick={savePreferences} disabled={saving}>
                      Salvar preferências
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
