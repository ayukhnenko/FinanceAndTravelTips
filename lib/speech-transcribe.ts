import { cleanSpeechTranscript, isKnownSpeechHallucination } from "@/lib/speech-hallucinations";

const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MIN_AUDIO_BYTES = 2_000;
const WHISPER_PROMPT =
  "Диктовка описания финансового кейса пользователем. Обычная разговорная речь на русском языке.";

type WhisperProvider = "groq" | "openai";

type WhisperConfig = {
  provider: WhisperProvider;
  url: string;
  apiKey: string;
  model: string;
  responseFormat: "json" | "verbose_json";
};

type WhisperSegment = {
  text?: string;
  no_speech_prob?: number;
  avg_logprob?: number;
};

type WhisperPayload = {
  text?: string;
  segments?: WhisperSegment[];
  error?: { message?: string; code?: string; type?: string };
};

function readSecretEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

function resolveWhisperConfig(): WhisperConfig | null {
  const groqKey = readSecretEnv("GROQ_API_KEY");
  if (groqKey) {
    return {
      provider: "groq",
      url: GROQ_WHISPER_URL,
      apiKey: groqKey,
      model: "whisper-large-v3",
      responseFormat: "verbose_json",
    };
  }

  const openAiKey = readSecretEnv("OPENAI_API_KEY");
  if (openAiKey) {
    return {
      provider: "openai",
      url: OPENAI_WHISPER_URL,
      apiKey: openAiKey,
      model: "whisper-1",
      responseFormat: "json",
    };
  }

  return null;
}

export function isSpeechTranscribeConfigured(): boolean {
  return resolveWhisperConfig() !== null;
}

function mapWhisperError(
  provider: WhisperProvider,
  status: number,
  apiError?: { message?: string; code?: string; type?: string }
): string {
  if (
    apiError?.code === "credit_balance_exhausted" ||
    apiError?.type === "insufficient_quota"
  ) {
    if (provider === "openai") {
      return "На аккаунте OpenAI закончились средства. Пополните баланс в platform.openai.com → Billing.";
    }
    return "Исчерпан лимит Groq. Попробуйте позже или добавьте GROQ_API_KEY с другим аккаунтом.";
  }

  if (apiError?.code === "rate_limit_exceeded" || status === 429) {
    return "Слишком много запросов к сервису расшифровки. Подождите минуту и попробуйте снова.";
  }

  if (apiError?.code === "invalid_api_key" || status === 401) {
    return provider === "groq"
      ? "Неверный GROQ_API_KEY. Проверьте ключ в .env.local."
      : "Неверный OPENAI_API_KEY. Проверьте ключ в .env.local.";
  }

  return "Не удалось расшифровать запись";
}

function extractTranscript(payload: WhisperPayload, provider: WhisperProvider): string {
  if (provider === "groq" && payload.segments?.length) {
    const spokenSegments = payload.segments
      .filter((segment) => {
        const noSpeech = segment.no_speech_prob ?? 0;
        const logprob = segment.avg_logprob ?? 0;
        return noSpeech < 0.45 && logprob > -1;
      })
      .map((segment) => segment.text?.trim() ?? "")
      .filter(Boolean);

    const fromSegments = cleanSpeechTranscript(spokenSegments.join(" "));
    if (fromSegments) return fromSegments;
  }

  return cleanSpeechTranscript(payload.text?.trim() ?? "");
}

export async function transcribeSpeechAudio(
  audio: File
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const config = resolveWhisperConfig();
  if (!config) {
    return {
      ok: false,
      error: "Расшифровка речи не настроена на сервере. Задайте GROQ_API_KEY.",
    };
  }

  if (audio.size === 0) {
    return { ok: false, error: "Запись пуста" };
  }

  if (audio.size < MIN_AUDIO_BYTES) {
    return {
      ok: false,
      error: "Запись слишком короткая. Говорите 1–2 секунды и только потом останавливайте.",
    };
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: "Запись слишком длинная. Сделайте более короткий фрагмент." };
  }

  const body = new FormData();
  body.append("file", audio, audio.name || "speech.webm");
  body.append("model", config.model);
  body.append("language", "ru");
  body.append("temperature", "0");
  body.append("prompt", WHISPER_PROMPT);
  body.append("response_format", config.responseFormat);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
    });

    const payload = (await response.json().catch(() => ({}))) as WhisperPayload;

    if (!response.ok) {
      console.error(`[speech-transcribe:${config.provider}] whisper error:`, payload);
      return { ok: false, error: mapWhisperError(config.provider, response.status, payload.error) };
    }

    const text = extractTranscript(payload, config.provider);
    if (!text) {
      if (isKnownSpeechHallucination(payload.text?.trim() ?? "")) {
        return {
          ok: false,
          error:
            "Речь не распознана — модель услышала только тишину. Говорите громче и чуть дольше.",
        };
      }
      return { ok: false, error: "Речь не распознана. Попробуйте говорить ближе к микрофону." };
    }

    return { ok: true, text };
  } catch (error) {
    console.error(`[speech-transcribe:${config.provider}] request failed:`, error);
    return { ok: false, error: "Не удалось расшифровать запись" };
  }
}
