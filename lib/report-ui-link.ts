type QueryValue = string | number | boolean | null | undefined;

export function buildReportUiLink(
  endpoint: string,
  params: Record<string, QueryValue>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    searchParams.set(key, String(value));
  }
  searchParams.set("format", "ui");

  return `${endpoint}?${searchParams.toString()}`;
}
