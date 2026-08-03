import {
  isResendConfigured,
  sendCaseAnsweredEmail,
  sendCaseFollowUpAdminEmail,
  sendCaseSubmittedAdminEmail,
  sendCaseSubmittedEmail,
} from "@/lib/resend-mail";
import { resolveSiteUrl } from "@/lib/site-url";
import type { UserCase } from "@/lib/cases-store";
import { resolveCaseRecipientEmail } from "@/lib/cases-store";
import { findUserById, listAdminEmails } from "@/lib/users-store";

function buildCaseUrl(caseId: string, guestToken?: string | null): string {
  const base = `${resolveSiteUrl()}/cases`;
  const params = new URLSearchParams({ case: caseId });
  if (guestToken) params.set("token", guestToken);
  return `${base}?${params.toString()}`;
}

function buildAdminCaseUrl(caseId: string): string {
  const params = new URLSearchParams({ case: caseId });
  return `${resolveSiteUrl()}/admin/cases?${params.toString()}`;
}

export async function notifyCaseSubmitted(input: {
  item: UserCase;
  isGuest: boolean;
  guestToken?: string | null;
}): Promise<void> {
  const email = resolveCaseRecipientEmail(input.item);
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

function buildCaseBodyPreview(body: string, max = 400): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function buildCaseAuthorLabel(item: UserCase): Promise<string> {
  if (item.userId) {
    const user = await findUserById(item.userId);
    if (user?.login) {
      return user.name?.trim() ? `${user.name.trim()} (@${user.login})` : `@${user.login}`;
    }
  }
  return item.guestEmail ? `Гость, ${item.guestEmail}` : "Гость";
}

export async function notifyAdminsCaseSubmitted(input: { item: UserCase }): Promise<void> {
  if (!isResendConfigured()) return;

  const adminEmails = await listAdminEmails();
  if (adminEmails.length === 0) return;

  const authorLabel = await buildCaseAuthorLabel(input.item);
  const adminCaseUrl = buildAdminCaseUrl(input.item.id);
  const bodyPreview = buildCaseBodyPreview(input.item.body);

  for (const to of adminEmails) {
    const result = await sendCaseSubmittedAdminEmail({
      to,
      title: input.item.title,
      authorLabel,
      bodyPreview,
      adminCaseUrl,
    });
    if (!result.ok) {
      console.error("[cases-mail] notifyAdminsCaseSubmitted:", to, result.error);
    }
  }
}

export async function notifyCaseAnswered(input: {
  item: UserCase;
  guestToken?: string | null;
}): Promise<void> {
  const email = resolveCaseRecipientEmail(input.item);
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

export async function notifyAssignedAdminCaseFollowUp(input: {
  item: UserCase;
  messageBody: string;
}): Promise<void> {
  if (!isResendConfigured() || !input.item.adminRespondedBy) return;

  const admin = await findUserById(input.item.adminRespondedBy);
  const to = admin?.email?.trim();
  if (!to) return;

  const authorLabel = await buildCaseAuthorLabel(input.item);
  const result = await sendCaseFollowUpAdminEmail({
    to,
    title: input.item.title,
    authorLabel,
    bodyPreview: buildCaseBodyPreview(input.messageBody),
    adminCaseUrl: buildAdminCaseUrl(input.item.id),
  });

  if (!result.ok) {
    console.error("[cases-mail] notifyAssignedAdminCaseFollowUp:", result.error);
  }
}
