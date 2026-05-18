const LOCAL_FALLBACK_URL = "http://localhost:3000";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function resolveSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!explicit) return LOCAL_FALLBACK_URL;
  return normalizeUrl(explicit);
}

