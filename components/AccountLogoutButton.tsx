"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccountLogoutButton() {
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
