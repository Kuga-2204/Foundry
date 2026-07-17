import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${EXT_BY_MIME[file.mimetype]}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error("Only JPG, PNG, WebP, GIF images and MP4, WebM, MOV videos are allowed."));
  },
});

export function kindOf(mimetype) {
  return mimetype.startsWith("video/") ? "video" : "image";
}
