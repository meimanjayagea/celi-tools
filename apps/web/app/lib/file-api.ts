/** Uploads go directly to the file API, outside Vercel's request body limit. */
export function fileApiEndpoint(operation: "capabilities" | "convert" | "compress") {
  const configured = process.env.NEXT_PUBLIC_FILE_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");
  if (!configured) throw new Error("Layanan file belum terhubung. Hubungi pengelola aplikasi.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Alamat layanan file tidak valid.");
  return new URL(`/api/files/${operation}`, url.origin).href;
}
