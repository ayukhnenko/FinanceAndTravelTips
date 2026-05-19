/**
 * Значение ключевой ставки ЦБ РФ для подстановки в поле НАОС по умолчанию.
 * Сайт cbr.ru часто отдаёт разметку без данных в SSR — надёжнее задать через
 * DEFAULT_KEY_RATE_PERCENT или обновлять константу при необходимости.
 */
const FALLBACK_KEY_RATE_PERCENT = 21;
const CBR_FETCH_TIMEOUT_MS = 1200;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
    },
    { once: true }
  );
  return controller.signal;
}

export async function getDefaultKeyRatePercent(): Promise<number> {
  const fromEnv = process.env.DEFAULT_KEY_RATE_PERCENT;
  if (fromEnv) {
    const n = parseFloat(fromEnv.replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }

  // In production, avoid blocking page render on external cbr.ru availability.
  // Use configured value (if present) or fallback constant.
  if (process.env.NODE_ENV === "production") {
    return FALLBACK_KEY_RATE_PERCENT;
  }

  try {
    const res = await fetch("https://www.cbr.ru/hd_base/KeyRate/", {
      next: { revalidate: 43200 },
      signal: createTimeoutSignal(CBR_FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LoanCalc/1.0)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return FALLBACK_KEY_RATE_PERCENT;
    const html = await res.text();
    const m = html.match(
      /<tr[^>]*class="[^"]*data[^"]*"[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(\d{1,2}\.\d{2}\.\d{4})[\s\S]*?<\/td>[\s\S]*?<td[^>]*>\s*(\d+,\d+)\s*<\/td>/i
    );
    if (m) {
      const rate = parseFloat(m[2].replace(",", "."));
      if (Number.isFinite(rate) && rate > 0 && rate < 200) return rate;
    }
    const simpler = html.match(
      /(\d{2}\.\d{2}\.\d{4})<\/td>\s*<td[^>]*>\s*(\d{1,2},\d{1,2})\s*<\/td>/
    );
    if (simpler) {
      const rate = parseFloat(simpler[2].replace(",", "."));
      if (Number.isFinite(rate) && rate > 0 && rate < 200) return rate;
    }
  } catch {
    /* use fallback */
  }

  return FALLBACK_KEY_RATE_PERCENT;
}
