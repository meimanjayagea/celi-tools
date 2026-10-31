/** Production API calls stay on this origin and are routed to the backend service. */
export function fileApiEndpoint(operation: "capabilities" | "convert" | "compress") {
  const configured = process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_FILE_API_URL || "http://localhost:3001" : window.location.origin;
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Alamat layanan file tidak valid.");
  return new URL(`/api/files/${operation}`, url.origin).href;
}
