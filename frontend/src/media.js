export function problemMediaUrl(file) {
  if (!file) return "";
  if (file.startsWith("/api/problems/media")) return file;
  if (file.includes("/storage/v1/object/public/")) {
    return `/api/problems/media?url=${encodeURIComponent(file)}`;
  }
  return file;
}
