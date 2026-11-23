import { useEffect, useState, type FormEvent } from "react";

import styles from "./PerfilPage.module.css";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Select,
  StarRating,
  Textarea,
} from "../../components/ui";
import { updateCompany } from "../../services/companies/companyService";
import { uploadCompanyMedia } from "../../services/storage/storageService";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { ReviewSection } from "../../components/reviews/ReviewSection/ReviewSection";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { formatCNPJ, formatDate } from "../../utils/format";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SEGMENTS = [
  "Reciclagem",
  "Sucata e metais",
  "Papel e papelão",
  "Plásticos",
  "Eletrônicos",
  "Químicos",
  "Orgânicos",
  "Logística reversa",
  "Indústria",
  "Comércio",
  "Outro",
];

function formatCEP(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export default function PerfilPage() {
  const { profile, user, refreshProfile } = useAuth();
  const bannerUrl = useMediaUrl(profile?.banner_url);
  const { success, error } = useToast();

  const [form, setForm] = useState({
    company_name: "",
    trade_name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    cep: "",
    city: "",
    state: "",
    segment: "",
    description: "",
    website: "",
    instagram: "",
    linkedin: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      company_name: profile.company_name ?? "",
      trade_name: profile.trade_name ?? "",
      cnpj: profile.cnpj ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      cep: profile.cep ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      segment: profile.segment ?? "",
      description: profile.description ?? "",
      website: profile.website ?? "",
      instagram: profile.instagram ?? "",
      linkedin: profile.linkedin ?? "",
    });
  }, [profile]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleLogo(file: File) {
    if (!profile) return;
    setUploadingLogo(true);
    try {
      const url = await uploadCompanyMedia(file, "logo", profile.id);
      await updateCompany(profile.id, { logo_url: url });
      await refreshProfile();
      success("Logo atualizada!");
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleBanner(file: File) {
    if (!profile) return;
    setUploadingBanner(true);
    try {
      const url = await uploadCompanyMedia(file, "banner", profile.id);
      await updateCompany(profile.id, { banner_url: url });
      await refreshProfile();
      success("Banner atualizado!");
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar o banner.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      await updateCompany(profile.id, {
        company_name: form.company_name.trim(),
        trade_name: form.trade_name.trim() || undefined,
        cnpj: form.cnpj.replace(/\D/g, "") || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        cep: form.cep.replace(/\D/g, "") || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        segment: form.segment || undefined,
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        linkedin: form.linkedin.trim() || undefined,
      });
      await refreshProfile();
      success("Perfil atualizado!");
    } catch {
      error("Falha ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Perfil da empresa</h2>
        <div className={styles.headerBadges}>
          {profile?.verified && <Badge variant="success">Empresa verificada</Badge>}
          <StarRating value={profile?.rating} count={profile?.review_count} readOnly />
        </div>
      </div>

      <Card className={styles.bannerCard}>
        <div className={styles.banner}>
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner da empresa" width={960} height={250} />
          ) : null}
          <label className={styles.bannerUpload}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleBanner(file);
              }}
            />
            {uploadingBanner ? "Enviando..." : "Alterar banner"}
          </label>
        </div>

        <div className={styles.bannerBody}>
          <Avatar
            src={profile?.logo_url ?? null}
            name={profile?.company_name ?? user?.email}
            size="xl"
          />
          <div className={styles.bannerInfo}>
            <h3>{profile?.company_name ?? "Minha empresa"}</h3>
            <p>
              Membro desde {formatDate(profile?.created_at)} · {profile?.email}
            </p>
            <label className={styles.logoUpload}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleLogo(file);
                }}
              />
              {uploadingLogo ? "Enviando..." : "Trocar logo"}
            </label>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card title="Dados da empresa" className={styles.card}>
          <div className={styles.row}>
            <Input
              label="Razão social"
              name="company_name"
              required
              value={form.company_name}
              onChange={(event) => update("company_name", event.target.value)}
            />
            <Input
              label="Nome fantasia"
              name="trade_name"
              value={form.trade_name}
              onChange={(event) => update("trade_name", event.target.value)}
            />
          </div>

          <div className={styles.row}>
            <Input
              label="CNPJ"
              name="cnpj"
              maxLength={18}
              value={formatCNPJ(form.cnpj)}
              onChange={(event) => update("cnpj", formatCNPJ(event.target.value))}
            />
            <Input
              label="Telefone"
              name="phone"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
            <Input
              label="E-mail"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </div>

          <Select
            label="Segmento"
            name="segment"
            placeholder="Selecione o segmento"
            value={form.segment}
            onChange={(event) => update("segment", event.target.value)}
            options={SEGMENTS.map((segment) => ({ value: segment, label: segment }))}
          />
        </Card>

        <Card title="Endereço" className={styles.card}>
          <div className={styles.row}>
            <Input
              label="CEP"
              name="cep"
              maxLength={9}
              value={formatCEP(form.cep)}
              onChange={(event) => update("cep", formatCEP(event.target.value))}
            />
            <Input
              label="Cidade"
              name="city"
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
            />
            <Select
              label="Estado"
              name="state"
              placeholder="UF"
              value={form.state}
              onChange={(event) => update("state", event.target.value)}
              options={UFS.map((uf) => ({ value: uf, label: uf }))}
            />
          </div>

          <Input
            label="Endereço"
            name="address"
            placeholder="Rua, número, bairro"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
          />

          <Textarea
            label="Sobre a empresa"
            name="description"
            rows={4}
            placeholder="Conte mais sobre sua empresa e sua atuação na economia circular."
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Card>

        <Card title="Presença online" className={styles.card}>
          <div className={styles.row}>
            <Input
              label="Site"
              name="website"
              placeholder="https://suaempresa.com.br"
              value={form.website}
              onChange={(event) => update("website", event.target.value)}
            />
            <Input
              label="Instagram"
              name="instagram"
              placeholder="@suaempresa"
              value={form.instagram}
              onChange={(event) => update("instagram", event.target.value)}
            />
            <Input
              label="LinkedIn"
              name="linkedin"
              placeholder="linkedin.com/company/suaempresa"
              value={form.linkedin}
              onChange={(event) => update("linkedin", event.target.value)}
            />
          </div>
        </Card>

        <div className={styles.actions}>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>

      {profile && (
        <ReviewSection companyId={profile.id} isOwnCompany />
      )}
    </div>
  );
}
