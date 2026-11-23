import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPackage, FiPlusCircle } from "react-icons/fi";

import styles from "./ProdutosPage.module.css";

import { Button, ConfirmDialog, EmptyState, Loader, Select } from "../../components/ui";
import ProductCard from "../../components/product/ProductCard/ProductCard";
import { archiveProduct, listMyProducts } from "../../services/products/productService";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import type { Product } from "../../types/product";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "sold", label: "Vendidos" },
];

export default function ProdutosPage() {
  const { profile, user } = useAuth();
  const companyId = profile?.id ?? user?.id ?? null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);

  const navigate = useNavigate();
  const { success, error } = useToast();

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await listMyProducts(companyId, status || undefined);
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function handleArchive(product: Product) {
    setProductToArchive(product);
  }

  async function confirmArchive() {
    if (!productToArchive) return;
    const product = productToArchive;
    setProductToArchive(null);
    try {
      await archiveProduct(product.id);
      setProducts((current) =>
        status && status !== "inactive"
          ? current.filter((item) => item.id !== product.id)
          : current.map((item) =>
              item.id === product.id ? { ...item, status: "inactive" } : item
            )
      );
      success("Produto arquivado.");
    } catch {
      error("Falha ao arquivar produto.");
    }
  }

  function handleEdit(product: Product) {
    navigate(`/cadastrar-produto?edit=${encodeURIComponent(product.id)}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Anúncios da empresa</h2>
          <p className={styles.subtitle}>
            {products.length} produto{products.length !== 1 ? "s" : ""} publicado
            {products.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className={styles.headerActions}>
          <Select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_OPTIONS}
          />
          <Button to="/cadastrar-produto">
            <FiPlusCircle /> Cadastrar produto
          </Button>
        </div>
      </div>

      {loading ? (
        <Loader text="Carregando seus produtos..." />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<FiPackage aria-hidden="true" />}
          title="Nenhum produto por aqui"
          description="Publique seu primeiro produto e comece a negociar na plataforma."
          action={
            <Button to="/cadastrar-produto">
              <FiPlusCircle /> Cadastrar produto
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              showActions
              onEdit={handleEdit}
              onDelete={handleArchive}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={productToArchive !== null}
        title="Arquivar produto"
        message={`Arquivar o produto "${productToArchive?.product}"? Ele sairá do marketplace e continuará disponível no histórico.`}
        confirmLabel="Arquivar"
        onConfirm={() => void confirmArchive()}
        onCancel={() => setProductToArchive(null)}
      />
    </div>
  );
}
