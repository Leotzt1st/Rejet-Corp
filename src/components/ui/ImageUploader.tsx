import { useId, useRef, useState } from "react";
import { FiImage, FiUpload, FiX } from "react-icons/fi";
import styles from "./ui.module.css";

interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  previewHeight?: number;
  hint?: string;
}

export function ImageUploader({
  label = "Imagem",
  value,
  onChange,
  previewHeight = 180,
  hint,
}: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Envie apenas imagens.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setPreview(dataUrl);
      onChange?.(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setPreview(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>

      {preview ? (
        <div className={styles.uploadPreview} style={{ height: previewHeight }}>
          <img src={preview} alt="Pré-visualização" />
          <div className={styles.uploadActions}>
            <button type="button" onClick={clearImage} aria-label="Remover imagem">
              <FiX /> Remover
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Trocar imagem"
            >
              <FiImage /> Trocar
            </button>
          </div>
        </div>
      ) : (
        <label
          className={styles.uploadDrop}
          style={{ minHeight: previewHeight }}
          htmlFor={inputId}
        >
          <FiUpload size={22} />
          <span>Clique para enviar uma imagem</span>
          {hint && <small>{hint}</small>}
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className={styles.uploadInput}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
