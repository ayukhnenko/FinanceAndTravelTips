"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, Suspense, useRef } from "react";
import { isCorrectVoicePassword, normalizeSpeechText } from "@/lib/voice-password";
import TelegramChannelPromo from "@/components/TelegramChannelPromo";
import VisitBadge from "@/components/VisitBadge";

type ListenState = "idle" | "listening" | "unsupported";

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function establishSession(entry: "voice" | "bypass"): Promise<boolean> {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry }),
  });
  return r.ok;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [listenState, setListenState] = useState<ListenState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [pending, setPending] = useState<"voice" | "bypass" | null>(null);

  const redirectAfterLogin = useCallback(() => {
    const from = searchParams.get("from");
    router.push(
      from && from.startsWith("/") && !from.startsWith("//") ? from : "/"
    );
    router.refresh();
  }, [router, searchParams]);

  const startVoice = useCallback(() => {
    setVoiceError(null);
    setLastHeard(null);
    setListenState("idle");

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setListenState("unsupported");
      setVoiceError(
        "Распознавание речи недоступно в этом браузере. Попробуйте Chrome или Edge."
      );
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    rec.onresult = async (event: SpeechRecognitionEvent) => {
      const raw = event.results[0]?.[0]?.transcript?.trim() ?? "";
      setLastHeard(raw);
      setListenState("idle");

      if (isCorrectVoicePassword(raw)) {
        setPending("voice");
        try {
          const ok = await establishSession("voice");
          if (ok) redirectAfterLogin();
          else setVoiceError("Не удалось войти. Попробуйте ещё раз.");
        } finally {
          setPending(null);
        }
        return;
      }

      setVoiceError(
        `Пароль назван неверно (распознано: «${normalizeSpeechText(raw) || "…"}»). Попробуйте ещё раз или воспользуйтесь кнопкой ниже.`
      );
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListenState("idle");
      if (event.error === "not-allowed") {
        setVoiceError("Нужен доступ к микрофону. Разрешите запись в настройках браузера.");
        return;
      }
      if (event.error === "no-speech") {
        setVoiceError("Речь не распознана. Попробуйте ещё раз.");
        return;
      }
      setVoiceError(`Ошибка микрофона: ${event.error}`);
    };

    rec.onend = () => {
      setListenState((s) => (s === "listening" ? "idle" : s));
    };

    setListenState("listening");
    try {
      rec.start();
    } catch {
      setListenState("idle");
      setVoiceError("Не удалось запустить распознавание речи.");
    }
  }, [redirectAfterLogin]);

  async function bypass() {
    setVoiceError(null);
    setPending("bypass");
    try {
      const ok = await establishSession("bypass");
      if (ok) redirectAfterLogin();
      else setVoiceError("Не удалось войти. Проверьте соединение.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card-panel w-full max-w-md space-y-6 !p-8 !shadow-[var(--shadow-card)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Вход</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Назовите вслух пароль или воспользуйтесь кнопкой ниже.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={startVoice}
            disabled={listenState === "listening" || pending !== null}
            className="btn-primary w-full"
          >
            {listenState === "listening"
              ? "Слушаю… говорите сейчас"
              : "Назвать пароль голосом"}
          </button>

          {lastHeard && !voiceError ? (
            <p className="text-center text-xs text-[var(--muted)]">
              Распознано: «{lastHeard}»
            </p>
          ) : null}

          {voiceError ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {voiceError}
            </p>
          ) : null}

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--card)] px-2 text-[var(--muted)]">
                или
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={bypass}
            disabled={pending !== null}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]/30 disabled:opacity-50"
          >
            {pending === "bypass" ? "Вход…" : "Все равно зайду"}
          </button>

          <p className="text-center text-sm">
            <Link href="/" className="link-accent">
              Вернуться на главную
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[var(--muted)]">
          Распознавание работает в Chrome, Edge и других браузерах с поддержкой
          Web Speech API. На телефоне включите микрофон для сайта.
        </p>

        <TelegramChannelPromo />

        <div className="flex flex-col items-center gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-xs text-[var(--muted)]">Посещения</span>
          <VisitBadge />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Загрузка…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
