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

// Upload with real progress. fetch cannot report upload progress, so
// this rides XMLHttpRequest: the editor shows percent while the photo
// travels, and a failure leaves the file in the owner's hand to retry
// in place (upload is a system of states, per the fullstack skill).
export function uploadPhotoToCloudinary(file: File, folder?: string, onProgress?: (pct: number) => void): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    return Promise.reject(new Error("Photo uploads are not switched on yet. Ask Claro & Co to connect your photo account."));
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);
  if (folder) form.append("folder", folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { secure_url?: string; error?: { message?: string } } | null = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* keep null */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) resolve(gradedPhotoUrl(String(data.secure_url)));
      else reject(new Error(data?.error?.message ?? `The upload did not finish (HTTP ${xhr.status}). Your photo is still here, tap Try again.`));
    };
    xhr.onerror = () => reject(new Error("The upload did not finish. Check your connection, your photo is still here, tap Try again."));
    xhr.send(form);
  });
}
