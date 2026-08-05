const KNOWN_HALLUCINATIONS = new Set([
  "продолжение следует",
  "продолжение следует...",
  "субтитры сделал dimatorzok",
  "субтитры создал dimatorzok",
  "субтитры добавил dimatorzok",
  "субтитры субтитров",
  "редактор субтитров",
  "корректор",
  "спасибо за внимание",
  "спасибо за просмотр",
  "thank you",
  "thanks for watching",
  "subscribe",
  "www",
  "amara.org",
]);

function normalizeTranscript(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/g, "")
    .replace(/\s+/g, " ");
}

export function isKnownSpeechHallucination(text: string): boolean {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;
  return KNOWN_HALLUCINATIONS.has(normalized);
}

export function cleanSpeechTranscript(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || isKnownSpeechHallucination(trimmed)) return "";
  return trimmed;
}
