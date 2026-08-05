export function appendTranscript(current: string, addition: string): string {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return current;
  if (!current.trim()) return trimmedAddition;
  return `${current.replace(/\s+$/, "")} ${trimmedAddition}`;
}
