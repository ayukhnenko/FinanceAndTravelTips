import { getAppStandLabel } from "@/lib/app-branding";

export const KEY_RATE_CRON_PATH = "/api/cron/sync-key-rate";

export type KeyRateCronJob = {
  id: string;
  scheduleUtc: string;
  timeMoscow: string;
  description: string;
};

/** Единый источник расписания; vercel.json должен ему соответствовать. */
export const KEY_RATE_CRON_JOBS: KeyRateCronJob[] = [
  {
    id: "morning",
    scheduleUtc: "0 0 * * *",
    timeMoscow: "03:00",
    description: "Утренняя синхронизация ставки ЦБ",
  },
  {
    id: "afternoon",
    scheduleUtc: "0 12 * * *",
    timeMoscow: "15:00",
    description: "Дневная синхронизация ставки ЦБ",
  },
  {
    id: "evening",
    scheduleUtc: "5 17 * * *",
    timeMoscow: "20:05",
    description: "Вечерняя синхронизация ставки ЦБ",
  },
];

export type AdminCronSettings = {
  environmentName: string;
  vercelEnv: string | null;
  standLabel: string | null;
  cronSecretConfigured: boolean;
  cronActiveOnDeploy: boolean;
  timezone: "Europe/Moscow";
  path: string;
  jobs: KeyRateCronJob[];
};

function resolveVercelEnvLabel(vercelEnv: string | undefined): string | null {
  if (vercelEnv === "production") return "Production";
  if (vercelEnv === "preview") return "Preview";
  if (vercelEnv === "development") return "Development";
  return null;
}

export function getAdminCronSettings(): AdminCronSettings {
  const standLabel = getAppStandLabel();
  const vercelEnv = process.env.VERCEL_ENV?.trim() || null;
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());

  const environmentName =
    standLabel ??
    resolveVercelEnvLabel(vercelEnv ?? undefined) ??
    (process.env.NODE_ENV === "production" ? "Production" : "Локально");

  return {
    environmentName,
    vercelEnv,
    standLabel,
    cronSecretConfigured,
    cronActiveOnDeploy: vercelEnv === "production" && cronSecretConfigured,
    timezone: "Europe/Moscow",
    path: KEY_RATE_CRON_PATH,
    jobs: KEY_RATE_CRON_JOBS,
  };
}
