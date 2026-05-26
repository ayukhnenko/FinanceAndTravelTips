"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  variant?: "button" | "icon";
};

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function AccountLogoutButton({ variant = "button" }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/user-logout", { method: "POST" });
      router.push("/account/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={pending}
        title="Выход"
        aria-label="Выход"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-60"
      >
        <LogoutIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={pending}
      className="btn-primary px-3 py-2 disabled:opacity-60"
    >
      {pending ? "Выход..." : "Выйти"}
    </button>
  );
}
