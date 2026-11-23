import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiArrowLeft, FiCamera, FiImage, FiMapPin, FiPackage, FiRefreshCw, FiStar, FiTag, FiTrash2, FiUpload } from "react-icons/fi";

import styles from "./CadastroProdutoPage.module.css";

import {
  Button,
  Checkbox,
  ConfirmDialog,
  Input,
  Select,
  Textarea,
  useToast,
} from "../../components/ui";
import {
  createProduct,
  getProduct,
  updateProduct,
} from "../../services/products/productService";
import {
  getMediaUrl,
  removeFile,
  uploadFile,
} from "../../services/storage/storageService";
import { listCategories, listSubcategories } from "../../services/categories/categoryService";
import { useAuth } from "../../contexts/AuthContext";
import { MATERIAL_TYPES, PRODUCT_CONDITIONS, PRODUCT_UNITS } from "../../types/product";
import type { Category, Subcategory } from "../../types/category";
import { formatCEPInput, fetchCep } from "../../utils/viacep";
import { formatCurrency, formatQuantity } from "../../utils/format";

const IMAGE_FORMATS = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5_000_000;

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const schema = z
  .object({
    product: z.string().trim().min(2, "Informe o nome do produto."),
    description: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    material_type: z.string().optional(),
    condition: z.string().optional(),
    quantities: z.string().optional(),
    unit: z.string().min(1, "Informe a unidade."),
    price: z.string().optional(),
    is_free: z.boolean(),
    negotiable: z.boolean(),
    min_quantity: z.string().optional(),
    has_pickup: z.boolean(),
    has_delivery: z.boolean(),
    cep: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    locationc: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.is_free) {
      const price = value.price === "" || value.price == null ? NaN : Number(value.price);
      if (isNaN(price) || price < 0) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Informe um preço válido." });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

interface ImageItem {
  id: string;
  path: string | null;
  url: string;
  uploading: boolean;
  error?: boolean;
  file?: File;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CadastroProdutoPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  return <ProductEditor key={editId ?? "new"} editId={editId} />;
}

function ProductEditor({ editId }: { editId: string | null }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [editFailed, setEditFailed] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photosRequired, setPhotosRequired] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const originalImages = useRef<ImageItem[]>([]);
  const saved = useRef(false);
  const previewUrls = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product: "",
      description: "",
      category: "",
      subcategory: "",
      material_type: "",
      condition: "",
      quantities: "",
      unit: "kg",
      price: "",
      is_free: false,
      negotiable: false,
      min_quantity: "",
      has_pickup: true,
      has_delivery: false,
      cep: "",
      city: "",
      state: "",
      locationc: "",
    },
  });

  const isFree = watch("is_free");
  const categoryValue = watch("category");
  const [productName, quantities, unit, price, city, state] = watch(["product", "quantities", "unit", "price", "city", "state"]);
  const addingImages = images.some((item) => item.uploading);
  const hasFailedImages = images.some((item) => item.error);
  const cover = images.find((item) => item.path && !item.error);
  const hasChanges = isDirty || images.length !== originalImages.current.length ||
    images.some((item, index) => item.id !== originalImages.current[index]?.id);
  const shouldProtect = hasChanges || isSubmitting;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldProtect && !saved.current &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  );
  const leaving = blocker.state === "blocked";

  useEffect(() => {
    if (!shouldProtect) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (saved.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [shouldProtect]);

  useEffect(() => {
    if (photosRequired && !isSubmitting) uploadButton.current?.focus();
  }, [photosRequired, isSubmitting]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.name === categoryValue),
    [categories, categoryValue]
  );

  useEffect(() => {
    let active = true;
    setSubcategories([]);
    if (!selectedCategory) {
      return;
    }
    listSubcategories(selectedCategory.id)
      .then((items) => {
        if (active) setSubcategories(items);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [selectedCategory]);

  useEffect(() => {
    if (!editId) return;
    let active = true;

    setLoadingEdit(true);
    setEditFailed(false);
    getProduct(editId)
      .then(async (target) => {
        if (!active) return;
        reset({
          product: target.product,
          description: target.description ?? "",
          category: target.category ?? "",
          subcategory: target.subcategory ?? "",
          material_type: target.material_type ?? "",
          condition: target.condition ?? "",
          quantities: target.quantities != null ? String(target.quantities) : "",
          unit: target.unit ?? "kg",
          price: target.price != null ? String(target.price) : "",
          is_free: target.is_free,
          negotiable: target.negotiable,
          min_quantity: target.min_quantity != null ? String(target.min_quantity) : "",
          has_pickup: target.has_pickup,
          has_delivery: target.has_delivery,
          cep: target.cep ? formatCEPInput(target.cep) : "",
          city: target.city ?? "",
          state: target.state ?? "",
          locationc: target.locationc ?? "",
        });

        const stored = [target.main_image ?? "", ...(target.images ?? [])]
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index);

        const previews = await Promise.all(
          stored.map(async (path) => ({
            id: uid(),
            path,
            url: (await getMediaUrl(path)) ?? "",
            uploading: false,
          }))
        );
        if (active) {
          originalImages.current = previews;
          setImages(previews);
        }
      })
      .catch(() => {
        if (active) setEditFailed(true);
      })
      .finally(() => {
        if (active) setLoadingEdit(false);
      });

    return () => { active = false; };
  }, [editId, reset]);

  function addImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!userId) {
      error("Você precisa estar autenticado para enviar imagens.");
      return;
    }

    const imagesToUpload = Array.from(files).filter((file) =>
      IMAGE_FORMATS.includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
    );
    setPhotoMessage(imagesToUpload.length < files.length ? "Use arquivos PNG, JPG ou WebP de até 5 MB." : "");
    setPhotosRequired(false);
    if (imagesToUpload.length === 0) return;

    const items: ImageItem[] = imagesToUpload
      .map((file) => {
        const url = URL.createObjectURL(file);
        previewUrls.current.add(url);
        return { id: uid(), path: null, url, uploading: true, file };
      });

    setImages((current) => [...current, ...items]);

    items.forEach(uploadDraftImage);
  }

  function uploadDraftImage(item: ImageItem) {
    if (!userId || !item.file) return;
    uploadFile(item.file, "images", userId)
        .then((path) => {
          if (!previewUrls.current.has(item.url)) {
            void removeFile(path).catch(() => undefined);
            return;
          }
          setImages((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, path, uploading: false, file: undefined } : entry
            )
          );
        })
        .catch(() => {
          if (!previewUrls.current.has(item.url)) return;
          setImages((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, uploading: false, error: true } : entry
            )
          );
        });
  }

  function retryImage(item: ImageItem) {
    setPhotoMessage("");
    setImages((current) => current.map((entry) =>
      entry.id === item.id ? { ...entry, uploading: true, error: false } : entry
    ));
    uploadDraftImage(item);
  }

  function discardDraftImage(item: ImageItem) {
    if (!previewUrls.current.delete(item.url)) return;
    URL.revokeObjectURL(item.url);
    if (item.path) void removeFile(item.path).catch(() => undefined);
  }

  function removeImage(id: string) {
    const item = images.find((entry) => entry.id === id);
    if (!item || item.uploading) return;
    discardDraftImage(item);
    setImages((current) => current.filter((entry) => entry.id !== id));
  }

  function resetDraft() {
    images.forEach(discardDraftImage);
    reset();
    setImages(originalImages.current);
    setPhotoMessage("");
    setPhotosRequired(false);
  }

  function setAsMain(id: string) {
    setImages((current) => {
      const target = current.find((entry) => entry.id === id);
      if (!target) return current;
      return [target, ...current.filter((entry) => entry.id !== id)];
    });
  }

  async function handleCepBlur() {
    const cep = watch("cep")?.replace(/\D/g, "");
    if (!cep || cep.length !== 8) return;
    const result = await fetchCep(cep);
    if (watch("cep")?.replace(/\D/g, "") !== cep) return;
    if (result) {
      setValue("city", result.city, { shouldDirty: true });
      setValue("state", result.state, { shouldDirty: true });
      info("Endereço preenchido automaticamente pelo CEP.");
    } else {
      error("CEP não encontrado ou serviço indisponível. Preencha cidade e estado manualmente.");
    }
  }

  async function onSubmit(values: FormValues) {
    if (!userId) {
      error("Você precisa estar autenticado.");
      return;
    }

    const ready = images.filter((item) => item.path && !item.error);
    if (ready.length === 0) {
      setPhotosRequired(true);
      return;
    }
    if (images.some((item) => item.uploading)) {
      error("Aguarde o upload das imagens terminar.");
      return;
    }
    if (hasFailedImages) {
      error("Reenvie ou remova as fotos que falharam.");
      return;
    }

    const paths = ready.map((item) => item.path as string);
    const payload = {
      product: values.product.trim(),
      description: values.description?.trim() || undefined,
      category: values.category || undefined,
      subcategory: values.subcategory || undefined,
      material_type: values.material_type || undefined,
      condition: values.condition || undefined,
      quantities: values.quantities ? Number(values.quantities) : undefined,
      unit: values.unit,
      price: values.is_free ? 0 : values.price ? Number(values.price) : undefined,
      is_free: values.is_free,
      negotiable: values.negotiable,
      min_quantity: values.min_quantity ? Number(values.min_quantity) : null,
      has_pickup: values.has_pickup,
      has_delivery: values.has_delivery,
      cep: values.cep ? values.cep.replace(/\D/g, "") : undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      locationc: values.locationc || undefined,
      main_image: paths[0],
      images: paths,
    };

    try {
      if (editId) {
        await updateProduct(editId, payload);
        saved.current = true;
        success("Produto atualizado com sucesso!");
      } else {
        const created = await createProduct({ ...payload, status: "active" });
        saved.current = true;
        success("Produto cadastrado com sucesso!");
        navigate(`/produto/${created.id}`);
        return;
      }
      navigate(`/produto/${editId}`);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Falha ao salvar o produto.";
      error(msg);
    }
  }

  if (loadingEdit) {
    return <p className={styles.loadingText} role="status">Carregando produto…</p>;
  }

  if (editId && editFailed) {
    return (
      <div className={styles.loadError}>
        <h2>Não foi possível carregar o produto</h2>
        <Button to="/produtos" variant="outline">Voltar para meus produtos</Button>
      </div>
    );
  }

  const location = [city, state].filter(Boolean).join(", ");
  const previewPrice = isFree ? "Gratuito" : price && Number(price) >= 0 ? formatCurrency(Number(price)) : "Preço a definir";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{editId ? "Editar anúncio" : "Novo anúncio"}</h2>
          <p>Campos com <span aria-hidden="true">*</span> são obrigatórios.</p>
        </div>
        <Link className={styles.backLink} to="/produtos">
          <FiArrowLeft aria-hidden="true" /> Meus produtos
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit, () => setPhotosRequired(false))} noValidate>
        <div className={styles.editor}>
          <section className={styles.section} aria-labelledby="editor-material">
            <h3 id="editor-material"><FiPackage aria-hidden="true" /> Material e quantidade</h3>

            <Input
              label="Nome do produto"
              error={errors.product?.message}
              aria-invalid={Boolean(errors.product)}
              required
              placeholder="Sucata de alumínio…"
              {...register("product")}
            />

            <div className={styles.row}>
              <Select
                label="Categoria"
                placeholder="Selecione"
                {...register("category")}
                onChange={(event) => {
                  setValue("category", event.target.value, { shouldDirty: true });
                  setValue("subcategory", "", { shouldDirty: true });
                }}
                options={categories.map(({ name }) => ({ value: name, label: name }))}
              />
              {subcategories.length > 0 && (
                <Select
                  label="Subcategoria"
                  placeholder="Selecione"
                  {...register("subcategory")}
                  options={subcategories.map(({ name }) => ({ value: name, label: name }))}
                />
              )}
              <Select
                label="Tipo de material"
                placeholder="Selecione"
                {...register("material_type")}
                options={MATERIAL_TYPES.map((material) => ({ value: material, label: material }))}
              />
            </div>

            <div className={styles.row}>
              <Input
                label="Quantidade disponível" type="number" min={0} step="any" inputMode="decimal"
                error={errors.quantities?.message}
                {...register("quantities")}
              />
              <Select
                label="Unidade" required error={errors.unit?.message}
                aria-invalid={Boolean(errors.unit)}
                {...register("unit")}
                options={PRODUCT_UNITS.map(({ value, label }) => ({ value, label }))}
              />
              <Select
                label="Condição" placeholder="Selecione"
                {...register("condition")}
                options={PRODUCT_CONDITIONS.map(({ value, label }) => ({ value, label }))}
              />
            </div>

            <Textarea
              label="Descrição"
              rows={3}
              placeholder="Descreva as dimensões e as condições de armazenamento…"
              {...register("description")}
            />
          </section>

          <section className={styles.section} aria-labelledby="editor-fotos">
            <h3 id="editor-fotos"><FiCamera aria-hidden="true" /> Fotos do produto</h3>
            <div className={styles.uploadArea}>
              <span className={styles.uploadIcon}><FiUpload aria-hidden="true" /></span>
              <div>
                <p id="editor-photo-format">PNG, JPG ou WebP de até 5 MB por foto.</p>
                <p>Use imagens autorizadas, sem documentos, rostos ou dados pessoais.</p>
              </div>
              <button
                type="button" ref={uploadButton} disabled={isSubmitting}
                className={styles.uploadButton}
                aria-describedby="editor-photo-format"
                onClick={() => fileInput.current?.click()}
              >
                Adicionar fotos
              </button>
              <input
                type="file" ref={fileInput} accept={IMAGE_FORMATS.join(",")} multiple hidden
                onChange={(event) => {
                  addImageFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {(photosRequired || photoMessage) && (
              <p className={styles.formError} role="alert">
                {photosRequired ? "Adicione pelo menos uma foto para salvar o anúncio." : photoMessage}
              </p>
            )}

            {(addingImages || hasFailedImages) && (
              <p className={styles.photoSummary} role="status">
                {addingImages && "Aguarde o envio das fotos antes de salvar. "}
                {hasFailedImages && "Reenvie ou remova as fotos que falharam."}
              </p>
            )}

            {images.length > 0 && (
              <ul className={styles.gallery} role="list">
                {images.map((item, index) => {
                  const isCover = item.id === cover?.id;
                  return (
                    <li key={item.id} className={styles.photo}>
                      <div className={styles.photoImage}>
                        {item.url ? (
                          <img src={item.url} alt={`Foto ${index + 1} do produto`} width={240} height={160} />
                        ) : <FiImage aria-hidden="true" />}
                        {isCover && <span className={styles.coverBadge}>Capa</span>}
                      </div>
                      <div className={styles.photoActions}>
                        {item.uploading ? (
                          <span role="status">Enviando foto {index + 1}…</span>
                        ) : (
                          <>
                            {item.error ? (
                              <div className={styles.photoRetry}>
                                <span role="status">Falha no envio da foto {index + 1}</span>
                                <button
                                  type="button" disabled={isSubmitting}
                                  aria-label={`Reenviar foto ${index + 1}`}
                                  onClick={() => retryImage(item)}
                                >
                                  <FiRefreshCw aria-hidden="true" /> Reenviar
                                </button>
                              </div>
                            ) : !isCover ? (
                              <button
                                type="button" disabled={isSubmitting}
                                aria-label={`Usar foto ${index + 1} como capa`}
                                onClick={() => setAsMain(item.id)}
                              >
                                <FiStar aria-hidden="true" /> Usar como capa
                              </button>
                            ) : <span>Foto principal</span>}
                            <button
                              type="button" disabled={isSubmitting}
                              aria-label={`Remover foto ${index + 1}`}
                              className={styles.removePhoto}
                              onClick={() => removeImage(item.id)}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="editor-preco">
            <h3 id="editor-preco"><FiTag aria-hidden="true" /> Preço e negociação</h3>
            <div className={styles.row}>
              <Input
                label="Preço (R$)" type="number" min={0} step="0.01" inputMode="decimal"
                disabled={isFree} required={!isFree} error={isFree ? undefined : errors.price?.message}
                aria-invalid={Boolean(errors.price) && !isFree}
                {...register("price")}
              />
              <Input
                label="Quantidade mínima" type="number" min={0} step="any" inputMode="decimal"
                error={errors.min_quantity?.message}
                {...register("min_quantity")}
              />
            </div>
            <div className={styles.options}>
              <Checkbox label="Doação (gratuito)" {...register("is_free")} />
              <Checkbox label="Aceito negociar o preço" {...register("negotiable")} />
            </div>
          </section>

          <section className={styles.section} aria-labelledby="editor-local">
            <h3 id="editor-local"><FiMapPin aria-hidden="true" /> Localização e retirada</h3>
            <div className={styles.row}>
              <Input
                label="CEP" maxLength={9} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000…"
                {...register("cep")}
                onChange={(event) => setValue("cep", formatCEPInput(event.target.value), { shouldDirty: true })}
                onBlur={() => void handleCepBlur()}
              />
              <Input label="Cidade" placeholder="São Paulo…" {...register("city")} />
              <Select
                label="Estado" placeholder="UF"
                {...register("state")}
                options={UFS.map((value) => ({ value, label: value }))}
              />
            </div>
            <Input label="Local de retirada" placeholder="Pátio ou ponto de coleta…" {...register("locationc")} />
            <div className={styles.options}>
              <Checkbox label="Aceito retirada no local" {...register("has_pickup")} />
              <Checkbox label="Ofereço entrega" {...register("has_delivery")} />
            </div>
          </section>
        </div>

        <aside className={styles.preview} aria-labelledby="editor-preview">
          <div className={styles.previewCard}>
            <h3 id="editor-preview">Prévia do anúncio</h3>
            <div className={styles.previewImage}>
              {cover?.url ? (
                <img src={cover.url} alt="Foto de capa na prévia do anúncio" width={320} height={180} />
              ) : (
                <><FiImage aria-hidden="true" /><span>A foto de capa aparecerá aqui</span></>
              )}
            </div>
            <div className={styles.previewBody}>
              {categoryValue && <p className={styles.previewCategory}>{categoryValue}</p>}
              <p className={styles.previewName}>{productName.trim() || "Nome do produto"}</p>
              <p className={styles.previewPrice}>{previewPrice}</p>
              {quantities && <p>{formatQuantity(Number(quantities), unit)}</p>}
              {location && <p className={styles.previewLocation}><FiMapPin aria-hidden="true" /> {location}</p>}
            </div>
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={isSubmitting || addingImages || hasFailedImages} block>
              {isSubmitting ? "Salvando…" : addingImages ? "Enviando fotos…" : editId ? "Salvar alterações" : "Publicar produto"}
            </Button>
            <Button type="button" variant="ghost" disabled={!hasChanges || isSubmitting || addingImages} onClick={() => setConfirmReset(true)} block>
              {editId ? "Desfazer alterações" : "Limpar formulário"}
            </Button>
          </div>
        </aside>
      </form>
      <ConfirmDialog
        open={leaving || confirmReset}
        title={leaving ? "Sair sem salvar?" : "Descartar alterações?"}
        message={leaving
          ? "O conteúdo e as fotos adicionadas desde a última versão salva serão descartados."
          : "As mudanças feitas desde a última versão salva serão descartadas."}
        confirmLabel={leaving ? "Sair sem salvar" : "Descartar alterações"}
        cancelLabel="Continuar editando"
        loading={isSubmitting}
        onCancel={() => {
          setConfirmReset(false);
          if (blocker.state === "blocked") blocker.reset();
        }}
        onConfirm={() => {
          if (isSubmitting) return;
          if (blocker.state === "blocked") {
            images.forEach(discardDraftImage);
            blocker.proceed();
          } else {
            resetDraft();
          }
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

