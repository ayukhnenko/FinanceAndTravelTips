const APP_STAND_LABEL = process.env.NEXT_PUBLIC_APP_STAND_LABEL?.trim() ?? "";

export function getAppStandLabel(): string | null {
  return APP_STAND_LABEL || null;
}

export function withAppStandLabel(title: string): string {
  const label = getAppStandLabel();
  if (!label) return title;
  return `${label} · ${title}`;
}
