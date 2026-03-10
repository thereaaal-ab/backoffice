/**
 * Server-side Supabase Storage for product image uploads.
 * Uses service role key; bucket must be public so store-front can display images.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import path from "path";

const BUCKET = "product-images";

function getSupabase() {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

let bucketEnsured: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return bucketEnsured;
  const supabase = getSupabase();
  if (!supabase) return;
  bucketEnsured = (async () => {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (error && error.message !== "The resource already exists") {
      console.warn("[supabaseStorage] createBucket:", error.message);
    }
  })();
  return bucketEnsured;
}

export interface UploadResult {
  objectPath: string;
  publicUrl: string;
}

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 * objectPath is the full public URL so products work on store-front without base URL.
 */
export async function uploadToSupabaseStorage(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<UploadResult | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await ensureBucket();
  const ext = path.extname(originalName) || ".jpg";
  const filePath = `uploads/${randomUUID()}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: contentType || "image/jpeg",
    upsert: false,
  });
  if (error) {
    console.error("[supabaseStorage] upload error:", error.message);
    if (error.message?.toLowerCase().includes("signature verification")) {
      console.error("[supabaseStorage] Hint: Check SUPABASE_SERVICE_ROLE_KEY in .env (no spaces/newlines, correct project). Use Dashboard → Settings → API → service_role.");
    }
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { objectPath: data.publicUrl, publicUrl: data.publicUrl };
}

export function isSupabaseStorageConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}
