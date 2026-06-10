import {
  isResendConfigured,
  sendCaseAnsweredEmail,
  sendCaseSubmittedEmail,
} from "@/lib/resend-mail";
import { resolveSiteUrl } from "@/lib/site-url";
import type { UserCase } from "@/lib/cases-store";

function buildCaseUrl(caseId: string, guestToken?: string | null): string {
  const base = `${resolveSiteUrl()}/cases`;
  const params = new URLSearchParams({ case: caseId });
  if (guestToken) params.set("token", guestToken);
  return `${base}?${params.toString()}`;
}

export async function notifyCaseSubmitted(input: {
  item: UserCase;
  isGuest: boolean;
  guestToken?: string | null;
}): Promise<void> {
  const email = input.item.guestEmail;
  if (!email || !isResendConfigured()) return;

  const result = await sendCaseSubmittedEmail({
    to: email,
    title: input.item.title,
    caseUrl: buildCaseUrl(input.item.id, input.guestToken),
    registerUrl: `${resolveSiteUrl()}/account/register?from=/cases`,
    isGuest: input.isGuest,
  });

  if (!result.ok) {
    console.error("[cases-mail] notifyCaseSubmitted:", result.error);
  }
}

export async function notifyCaseAnswered(input: {
  item: UserCase;
  guestToken?: string | null;
}): Promise<void> {
  const email = input.item.guestEmail;
  if (!email || !isResendConfigured()) return;

  const result = await sendCaseAnsweredEmail({
    to: email,
    title: input.item.title,
    caseUrl: buildCaseUrl(input.item.id, input.guestToken),
  });

  if (!result.ok) {
    console.error("[cases-mail] notifyCaseAnswered:", result.error);
  }
}
