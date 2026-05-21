import { getAppStandLabel } from "@/lib/app-branding";

export const DEPOSITS_CRON_PATH = "/api/cron/sync-deposits";

export type DepositsCronJob = {
  id: string;
  scheduleUtc: string;
  timeMoscow: string;
  description: string;
};

/** Единый источник расписания; vercel.json должен ему соответствовать. */
export const DEPOSITS_CRON_JOBS: DepositsCronJob[] = [
  {
    id: "daily-morning",
    scheduleUtc: "0 4 * * *",
    timeMoscow: "07:00",
    description: "Синхронизация вкладов из Google Sheets (ежедневно)",
  },
];

export type AdminDepositsCronSettings = {
  environmentName: string;
  vercelEnv: string | null;
  standLabel: string | null;
  cronSecretConfigured: boolean;
  cronActiveOnDeploy: boolean;
  timezone: "Europe/Moscow";
  path: string;
  jobs: DepositsCronJob[];
};

function resolveVercelEnvLabel(vercelEnv: string | undefined): string | null {
  if (vercelEnv === "production") return "Production";
  if (vercelEnv === "preview") return "Preview";
  if (vercelEnv === "development") return "Development";
  return null;
}

export function getAdminDepositsCronSettings(): AdminDepositsCronSettings {
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
    path: DEPOSITS_CRON_PATH,
    jobs: DEPOSITS_CRON_JOBS,
  };
}
