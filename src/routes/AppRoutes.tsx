import { lazy, Suspense } from "react";
import { createBrowserRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from "react-router-dom";

import PrivateRoute from "./PrivateRoute";
import AppLayout from "../components/layout/AppLayout/AppLayout";
import { Button, Loader } from "../components/ui";

const LoginPage = lazy(() => import("../pages/auth/Login/LoginPage"));
const ResetPasswordPage = lazy(() => import("../pages/auth/ResetPassword/ResetPasswordPage"));
const DashboardPage = lazy(() => import("../pages/auth/dashboard/DashboardPage"));
const MarketplacePage = lazy(() => import("../pages/Marketplace/MarketplacePage"));
const ProductDetailPage = lazy(() => import("../pages/ProductDetail/ProductDetailPage"));
const ProdutosPage = lazy(() => import("../pages/Produtos/ProdutosPage"));
const CadastroProdutoPage = lazy(() => import("../pages/CadastroProduto/CadastroProdutoPage"));
const NegociacoesPage = lazy(() => import("../pages/Negociacoes/NegociacoesPage"));
const NegociacaoDetailPage = lazy(() => import("../pages/Negociacoes/NegociacaoDetailPage"));
const FinancePage = lazy(() => import("../pages/Finance/FinancePage"));
const ChatPage = lazy(() => import("../pages/Chat/ChatPage"));
const FavoritosPage = lazy(() => import("../pages/Favoritos/FavoritosPage"));
const NotificacoesPage = lazy(() => import("../pages/Notificacoes/NotificacoesPage"));
const RelatoriosPage = lazy(() => import("../pages/Relatorios/RelatoriosPage"));
const PerfilPage = lazy(() => import("../pages/Perfil/PerfilPage"));
const ConfigPage = lazy(() => import("../pages/Config/ConfigPage"));
const AdminPage = lazy(() => import("../pages/Admin/AdminPage"));
const TransparencyPage = lazy(() => import("../pages/Transparency/TransparencyPage"));

function PageFallback() {
  return <Loader text="Carregando..." fullPage />;
}

function NotFoundPage() {
  return (
    <main className="blockedScreen">
      <div className="blockedCard">
        <h1>Página não encontrada</h1>
        <p>Confira o endereço ou volte ao início da Rejet Corp.</p>
        <Button to="/">Voltar ao início</Button>
      </div>
    </main>
  );
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<Suspense fallback={<PageFallback />}><Outlet /></Suspense>}>
    <Route path="/" element={<LoginPage />} />
    <Route path="/informacoes" element={<TransparencyPage />} />
    <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

    <Route
      element={
        <PrivateRoute>
          <AppLayout />
        </PrivateRoute>
      }
    >
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/produto/:id" element={<ProductDetailPage />} />
      <Route path="/produtos" element={<ProdutosPage />} />
      <Route path="/cadastrar-produto" element={<CadastroProdutoPage />} />
      <Route path="/negociacoes" element={<NegociacoesPage />} />
      <Route path="/negociacoes/:id" element={<NegociacaoDetailPage />} />
      <Route path="/financeiro" element={<FinancePage />} />
      <Route path="/mensagens" element={<ChatPage />} />
      <Route path="/favoritos" element={<FavoritosPage />} />
      <Route path="/notificacoes" element={<NotificacoesPage />} />
      <Route path="/relatorios" element={<RelatoriosPage />} />
      <Route path="/perfil" element={<PerfilPage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Route>
));

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
