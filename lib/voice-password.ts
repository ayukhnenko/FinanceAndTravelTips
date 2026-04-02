/** Нормализация текста с распознавания речи для сравнения */
export function normalizeSpeechText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-яё0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ожидаемая фраза-пароль: «восемьдесят один» (81) */
export function isCorrectVoicePassword(raw: string): boolean {
  const t = normalizeSpeechText(raw);
  if (!t) return false;

  if (t.includes("восемьдесятодин")) return true;
  if (t.includes("восемьдесят") && t.includes("один")) return true;

  const tokens = t.split(/\s+/);
  if (tokens.some((w) => w === "81")) return true;
  if (/(?:^|\s)81(?:\s|$)/.test(t)) return true;

  return false;
}
