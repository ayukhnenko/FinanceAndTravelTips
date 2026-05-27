export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703";
}

export function normalizeUserId(id: string): string {
  return id.trim().toLowerCase();
}
