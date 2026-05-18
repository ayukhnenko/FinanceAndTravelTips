"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type UiLanguage = "ru" | "en";

type I18nContextValue = {
  lang: UiLanguage;
  setLang: (lang: UiLanguage) => void;
  tr: (ru: string, en: string) => string;
};

const STORAGE_KEY = "loan_calc_ui_lang_v1";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<UiLanguage>("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") {
      setLang(saved);
      return;
    }

    const preferred = (navigator.language || "").toLowerCase();
    if (preferred.startsWith("en")) {
      setLang("en");
    } else {
      setLang("ru");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const tr = useCallback(
    (ru: string, en: string) => (lang === "en" ? en : ru),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, tr }),
    [lang, setLang, tr]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
}
