"use client";

import { useState } from "react";

type Props = {
  href: string | null;
  idleLabel: string;
  copiedLabel: string;
};

export default function CopyApiUiLinkButton({
  href,
  idleLabel,
  copiedLabel,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!href) return;
    const absolute = href.startsWith("/")
      ? `${window.location.origin}${href}`
      : href;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      disabled={!href}
      className="inline-block text-sm font-medium text-[var(--link)] underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
