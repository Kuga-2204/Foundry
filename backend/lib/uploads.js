import multer from "multer";
import crypto from "crypto";

// Extensions come from this whitelist, never from the client's filename, so a
// renamed executable can't land on disk with its real extension.
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error("Only JPG, PNG, WebP, GIF images and MP4, WebM, MOV videos are allowed."));
  },
});

export function kindOf(mimetype) {
  return mimetype.startsWith("video/") ? "video" : "image";
}

function requiredStorageEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload media to Supabase Storage."
    );
  }
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "problem-media",
  };
}

export async function uploadProblemMedia(file, problemId) {
  const ext = EXT_BY_MIME[file.mimetype];
  if (!ext) throw new Error("Unsupported media type.");

  const { supabaseUrl, serviceKey, bucket } = requiredStorageEnv();
  const objectPath = `problems/${problemId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": file.mimetype,
      "Cache-Control": "31536000",
      "x-upsert": "false",
    },
    body: file.buffer,
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}). ${details}`.trim());
  }

  return {
    url: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`,
    kind: kindOf(file.mimetype),
  };
}
