function parseRublesFromDigitsText(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const rubles = Number(digits);
  if (!Number.isFinite(rubles) || rubles <= 0) return null;
  return rubles;
}

function formatTopbankiRubAmount(rubles: number, prefix?: "до"): string {
  const formatted = rubles.toLocaleString("ru-RU");
  return prefix ? `${prefix} ${formatted} ₽` : `${formatted} ₽`;
}

function resolveTopbankiUrl(listUrl: string): URL | null {
  try {
    return new URL(
      listUrl.startsWith("http")
        ? listUrl
        : `https://topbanki.ru${listUrl.startsWith("/") ? listUrl : `/${listUrl}`}`
    );
  } catch {
    return null;
  }
}

export function parseTopbankiComparisonSumRubles(html: string, listUrl: string): number | null {
  const totalSumMatch = html.match(/id="total_sum"[^>]*value="([^"]*)"/i);
  const fromInput = parseRublesFromDigitsText(totalSumMatch?.[1] ?? "");
  if (fromInput) return fromInput;

  const url = resolveTopbankiUrl(listUrl);
  const fromQuery = parseRublesFromDigitsText(url?.searchParams.get("sum") ?? "");
  if (fromQuery) return fromQuery;

  const descMatch = html.match(/с\s+суммой\s+открытия\s+до\s+([\d\s]+)\s*руб/i);
  return parseRublesFromDigitsText(descMatch?.[1] ?? "");
}

export function formatTopbankiComparisonSumText(
  html: string,
  listUrl: string
): { rubles: number | null; text: string } {
  const totalSumMatch = html.match(/id="total_sum"[^>]*value="([^"]*)"/i);
  const hasExplicitInput = Boolean(parseRublesFromDigitsText(totalSumMatch?.[1] ?? ""));

  const url = resolveTopbankiUrl(listUrl);
  const hasExplicitQuery = Boolean(parseRublesFromDigitsText(url?.searchParams.get("sum") ?? ""));

  const rubles = parseTopbankiComparisonSumRubles(html, listUrl);
  if (rubles == null) return { rubles: null, text: "" };

  const text =
    hasExplicitInput || hasExplicitQuery
      ? formatTopbankiRubAmount(rubles)
      : formatTopbankiRubAmount(rubles, "до");

  return { rubles, text };
}

export function formatTopbankiComparisonSumFromUrl(listUrl: string): string {
  const url = resolveTopbankiUrl(listUrl);
  const rubles = parseRublesFromDigitsText(url?.searchParams.get("sum") ?? "");
  if (rubles) return formatTopbankiRubAmount(rubles);

  return formatTopbankiRubAmount(150_000, "до");
}
