import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

export async function putFile(
  bucket: string,
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const { error } = await supabase.storage.from(bucket).upload(key, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(
      `Supabase Storage Upload fehlgeschlagen (${bucket}/${key}): ${error.message}`,
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);

  return {
    path: key,
    publicUrl: data.publicUrl,
  };
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([key]);

  if (error) {
    throw new Error(
      `Supabase Storage Löschen fehlgeschlagen (${bucket}/${key}): ${error.message}`,
    );
  }
}

export async function readFile(bucket: string, key: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(key);

  if (error || !data) {
    throw new Error(
      `Supabase Storage Lesen fehlgeschlagen (${bucket}/${key}): ${error?.message ?? "keine Daten"}`,
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(
  bucket: string,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, expiresInSeconds);

  if (error || !data) {
    throw new Error(
      `Supabase Storage Signed-URL fehlgeschlagen (${bucket}/${key}): ${error?.message ?? "keine Daten"}`,
    );
  }

  return data.signedUrl;
}
