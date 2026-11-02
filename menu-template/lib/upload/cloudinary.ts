// Cloudinary UNSIGNED upload for the owner editor.
//
// The editor uploads straight from the browser to the restaurant's own
// Cloudinary account using an unsigned upload preset. No API key and no
// API secret are involved, which is why the two values below are safe as
// NEXT_PUBLIC env vars. The preset itself controls the target folder and
// any restrictions, and it is created per client account at onboarding.
//
// Env (set in .env.local, see .env.example):
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
//
// The returned delivery URL passes through gradedPhotoUrl, the same grade
// helper the guest view applies, so an uploaded photo carries the Claro
// realistic finish in its URL and the stored value stays consistent.
// NOTE: the live storage meter is separate. Reading real usage needs the
// Cloudinary Admin API (key + secret, server-side) and is wired later;
// the editor meter stays a placeholder until then.
import { gradedPhotoUrl } from "../engine/photo-grade";

export function cloudinaryUploadConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  );
}

export async function uploadPhotoToCloudinary(file: File, folder?: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    throw new Error("Cloudinary upload is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);
  if (folder) form.append("folder", folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message ?? `Cloudinary upload failed (HTTP ${res.status}).`);
  }
  return gradedPhotoUrl(String(data.secure_url));
}
