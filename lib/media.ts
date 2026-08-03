import { ENV } from "./env";

/**
 * Resolves a possibly-relative media path (profile photo, banner, etc.) into an
 * absolute URL. Normalizes the join so a path stored without its leading slash
 * (as some already-uploaded rows are) never produces a mangled host like
 * "apiurl.comuploads/..." from naive `${API_URL}${path}` concatenation.
 */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${ENV.API_URL}/${path.replace(/^\/+/, "")}`;
}
