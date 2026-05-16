"use client";

import { useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  const options: Array<{ id: "ru" | "en"; label: string }> = [
    { id: "ru", label: "RU" },
    { id: "en", label: "EN" },
  ];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setLang(opt.id)}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
            lang === opt.id
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
          aria-pressed={lang === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
