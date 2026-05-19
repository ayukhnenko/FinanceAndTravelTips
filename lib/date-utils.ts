export function todayIsoDateMoscow(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(
    new Date()
  );
}

export function formatPercentInput(value: number): string {
  return String(value).replace(".", ",");
}
