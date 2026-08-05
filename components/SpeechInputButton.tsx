"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
  type BrowserSpeechRecognition,
} from "@/lib/speech-recognition-client";

type SpeechInputButtonProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  continuous?: boolean;
  className?: string;
};

const SPEECH_LANG = "ru-RU";

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export default function SpeechInputButton({
  onTranscript,
  disabled = false,
  continuous = true,
  className = "",
}: SpeechInputButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup errors
      }
      recognitionRef.current = null;
    };
  }, []);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isListening) {
      stopRequestedRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
        setIsListening(false);
      }
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition || disabled) return;

    setError(null);
    stopRequestedRef.current = false;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = SPEECH_LANG;
      recognition.continuous = continuous;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
        stopRequestedRef.current = false;
      };

      recognition.onerror = (speechEvent) => {
        if (stopRequestedRef.current && speechEvent.error === "aborted") {
          recognitionRef.current = null;
          setIsListening(false);
          stopRequestedRef.current = false;
          return;
        }

        if (speechEvent.error !== "aborted") {
          setError(mapSpeechRecognitionError(speechEvent.error));
        }
        recognitionRef.current = null;
        setIsListening(false);
        stopRequestedRef.current = false;
      };

      recognition.onresult = (speechEvent) => {
        let transcript = "";
        for (let index = speechEvent.resultIndex; index < speechEvent.results.length; index += 1) {
          const result = speechEvent.results[index];
          if (result?.isFinal) {
            transcript += result[0]?.transcript ?? "";
          }
        }

        const trimmed = transcript.trim();
        if (trimmed) {
          onTranscriptRef.current(trimmed);
          setError(null);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setError("Не удалось начать запись.");
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className={`relative shrink-0 ${className}`.trim()}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-pressed={isListening}
        title={isListening ? "Остановить запись" : "Надиктовать текст"}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
          isListening
            ? "border-rose-400 bg-rose-50 text-rose-700"
            : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--accent-soft)]/40"
        }`}
      >
        <MicIcon className={`h-4 w-4 ${isListening ? "animate-pulse" : ""}`} />
        {isListening ? "Идёт запись..." : "Надиктовать"}
      </button>
      {error ? (
        <div
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-rose-200 bg-[var(--card)] p-2 text-[10px] leading-snug text-rose-700 shadow-[var(--shadow-card)]"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
