const APP_STAND_LABEL = process.env.NEXT_PUBLIC_APP_STAND_LABEL?.trim() ?? "";

function isProdStandLabel(label: string): boolean {
  return label.toUpperCase() === "PROD";
}

export function getAppStandLabel(): string | null {
  return APP_STAND_LABEL || null;
}

/** Метка для публичного UI; PROD не показывается в шапке и на главной. */
export function getPublicAppStandLabel(): string | null {
  const label = getAppStandLabel();
  if (!label || isProdStandLabel(label)) return null;
  return label;
}

export function standLabelClassName(label: string): string {
  return isProdStandLabel(label) ? "stand-label-prod" : "text-[var(--accent)]";
}

export function withAppStandLabel(title: string): string {
  const label = getPublicAppStandLabel();
  if (!label) return title;
  return `${label} · ${title}`;
}

export function withAdminAppStandLabel(title: string): string {
  const label = getAppStandLabel();
  if (!label) return title;
  return `${label} · ${title}`;
}
