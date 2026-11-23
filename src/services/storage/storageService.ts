import { supabase } from "../supabase/client";

const BUCKET = "produtos";
const MAX_FILE_BYTES = 5_000_000;
const IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

const bucket = supabase.storage.from(BUCKET);
const oldPublicPrefix = new URL(bucket.getPublicUrl("legacy-marker").data.publicUrl);
oldPublicPrefix.pathname = oldPublicPrefix.pathname.slice(0, -"legacy-marker".length);

export async function getMediaUrl(path: string | null | undefined, download = false) {
  if (!path) return null;
  let objectPath = path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    try {
      const url = new URL(path);
      if (url.origin !== oldPublicPrefix.origin || !url.pathname.startsWith(oldPublicPrefix.pathname)) return null;
      objectPath = decodeURIComponent(url.pathname.slice(oldPublicPrefix.pathname.length));
    } catch {
      return null;
    }
  }
  if (objectPath.includes("\\") || objectPath.split("/").some((part) => !part || part === "." || part === "..")) {
    return null;
  }
  const { data } = await bucket.createSignedUrl(objectPath, 300, { download });
  return data?.signedUrl ?? null;
}

export async function uploadFile(
  file: File,
  folder: "images" | "documents",
  userId: string
) {
  const extension = folder === "documents" ? (file.type === "application/pdf" ? "pdf" : undefined) : IMAGE_TYPES.get(file.type);
  if (!extension || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error(folder === "documents" ? "Envie um PDF de até 5 MB." : "Envie uma imagem JPG, PNG ou WebP de até 5 MB.");
  }
  const safeName = `${crypto.randomUUID()}.${extension}`;
  const path = `${userId}/${folder}/${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;
  return path;
}

export async function uploadImages(files: File[], userId: string) {
  const paths: string[] = [];
  for (const file of files) {
    paths.push(await uploadFile(file, "images", userId));
  }
  return paths;
}

export async function uploadDocuments(files: File[], userId: string) {
  const paths: string[] = [];
  for (const file of files) {
    paths.push(await uploadFile(file, "documents", userId));
  }
  return paths;
}

export async function removeFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function uploadCompanyMedia(
  file: File,
  kind: "logo" | "banner",
  userId: string
) {
  const extension = IMAGE_TYPES.get(file.type);
  if (!extension || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP de até 5 MB.");
  }
  const path = `${userId}/company/${kind}-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;

  return path;
}
