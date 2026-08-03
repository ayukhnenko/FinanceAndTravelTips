"use client";

import { formatDateTimeMoscow } from "@/lib/date-utils";
import type { CaseMessageView } from "@/lib/cases-client";

type CaseThreadProps = {
  initialBody: string;
  initialAt: string | null;
  authorLabel?: string;
  userLabel?: string;
  messages: CaseMessageView[];
};

function senderLabel(message: CaseMessageView, userLabel?: string): string {
  if (message.senderKind === "admin") {
    if (message.senderName?.trim()) return message.senderName.trim();
    if (message.senderLogin) return `@${message.senderLogin}`;
    return "Аналитик";
  }
  if (message.senderName?.trim()) return message.senderName.trim();
  if (message.senderLogin) return `@${message.senderLogin}`;
  return userLabel ?? "Вы";
}

export default function CaseThread({
  initialBody,
  initialAt,
  authorLabel = "Вы",
  userLabel,
  messages,
}: CaseThreadProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3">
        <div className="text-xs text-[var(--muted)]">
          {authorLabel}
          {initialAt ? ` · ${formatDateTimeMoscow(initialAt)}` : ""}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground)]">{initialBody}</p>
      </div>

      {messages.map((message) => {
        const isAdmin = message.senderKind === "admin";
        return (
          <div
            key={message.id}
            className={`rounded-lg border p-3 ${
              isAdmin
                ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/40"
                : "border-[var(--border)] bg-[var(--input-bg)]"
            }`}
          >
            <div className="text-xs text-[var(--muted)]">
              {senderLabel(message, userLabel)}
              {message.createdAt ? ` · ${formatDateTimeMoscow(message.createdAt)}` : ""}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {message.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
