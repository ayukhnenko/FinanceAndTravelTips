"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

type SpeechInputButtonProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

const MAX_RECORDING_MS = 120_000;
const MIN_RECORDING_MS = 1_000;
const RECORDING_TIMESLICE_MS = 250;

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

function pickRecordingMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function fileExtensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export default function SpeechInputButton({
  onTranscript,
  disabled = false,
  className = "",
}: SpeechInputButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");
  const recordingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  const cleanupStream = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    recordingStartedAtRef.current = null;
  };

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore cleanup errors
      }
      cleanupStream();
    };
  }, []);

  async function transcribeRecording(blob: Blob) {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      const extension = fileExtensionForMimeType(mimeTypeRef.current);
      formData.append("audio", blob, `speech.${extension}`);

      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        text?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.text?.trim()) {
        setError(data.error ?? "Не удалось расшифровать запись");
        return;
      }

      onTranscriptRef.current(data.text.trim());
      setError(null);
    } catch {
      setError("Не удалось расшифровать запись");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startRecording() {
    setError(null);
    chunksRef.current = [];

    const mimeType = pickRecordingMimeType();
    if (!mimeType) {
      setError("Запись аудио не поддерживается в этом браузере.");
      return;
    }
    mimeTypeRef.current = mimeType;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Не удалось записать аудио.");
        setIsRecording(false);
        cleanupStream();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const startedAt = recordingStartedAtRef.current;
        cleanupStream();
        setIsRecording(false);

        if (startedAt !== null && Date.now() - startedAt < MIN_RECORDING_MS) {
          setError("Говорите чуть дольше — минимум 1 секунда, затем остановите запись.");
          return;
        }

        if (blob.size === 0) {
          setError("Запись пуста. Попробуйте ещё раз.");
          return;
        }

        void transcribeRecording(blob);
      };

      recorder.start(RECORDING_TIMESLICE_MS);
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      stopTimerRef.current = setTimeout(() => {
        try {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        } catch {
          setIsRecording(false);
          cleanupStream();
        }
      }, MAX_RECORDING_MS);
    } catch {
      cleanupStream();
      setIsRecording(false);
      setError("Нет доступа к микрофону. Разрешите запись в настройках браузера.");
    }
  }

  function stopRecording() {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.requestData();
        window.setTimeout(() => {
          try {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          } catch {
            setIsRecording(false);
            cleanupStream();
            setError("Не удалось остановить запись.");
          }
        }, 120);
      } else {
        setIsRecording(false);
        cleanupStream();
      }
    } catch {
      setIsRecording(false);
      cleanupStream();
      setError("Не удалось остановить запись.");
    }
  }

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled || isTranscribing) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  };

  if (!isSupported) {
    return (
      <p
        className={`max-w-xs text-right text-[10px] leading-snug text-[var(--muted)] ${className}`.trim()}
      >
        Голосовой ввод недоступен в этом браузере.
      </p>
    );
  }

  const isBusy = isRecording || isTranscribing;

  return (
    <div className={`relative shrink-0 ${className}`.trim()}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isTranscribing}
        aria-pressed={isRecording}
        title={isRecording ? "Остановить и расшифровать" : "Надиктовать текст"}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
          isBusy
            ? "border-rose-400 bg-rose-50 text-rose-700"
            : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--accent-soft)]/40"
        }`}
      >
        <MicIcon className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
        {isTranscribing ? "Расшифровка..." : isRecording ? "Идёт запись..." : "Надиктовать"}
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
