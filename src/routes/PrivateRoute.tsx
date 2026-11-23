import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui";
import type { JSX } from "react/jsx-runtime";

interface Props {
  children: JSX.Element;
}

export default function PrivateRoute({ children }: Props) {
  const { user, loading, accountBlocked, clearSession } = useAuth();
  const { pathname, search, hash } = useLocation();

  if (loading) {
    return (
      <div className="privateLoading">
        <span className="spinner" />
        <p>Carregando sessão...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/?entrar=1" state={{ returnTo: { pathname, search, hash } }} replace />;
  }

  if (accountBlocked) {
    return (
      <div className="blockedScreen">
        <div className="blockedCard">
          <span className="blockedIcon">🚫</span>
          <h1>Conta desativada</h1>
          <p>
            Sua conta foi desativada pela administração da plataforma.
            Se você acredita que isto é um engano, entre em contato com o
            suporte.
          </p>
          <Button variant="danger" onClick={() => void clearSession()}>
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  return children;
}
