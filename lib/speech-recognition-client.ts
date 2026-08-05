export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
};

type SpeechRecognitionResultItem = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const scope = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function mapSpeechRecognitionError(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Нет доступа к микрофону. Разрешите запись в настройках браузера.";
  }
  if (error === "no-speech") {
    return "Речь не распознана. Попробуйте ещё раз.";
  }
  if (error === "network") {
    return "Сервис распознавания речи недоступен. Браузер обращается к серверам Google — они могут быть заблокированы даже при работающем интернете. Попробуйте Safari или введите текст вручную.";
  }
  if (error === "language-not-supported") {
    return "Русский язык для распознавания недоступен в этом браузере.";
  }
  if (error === "aborted") {
    return "Запись остановлена.";
  }
  return "Не удалось распознать речь.";
}

export function appendTranscript(current: string, addition: string): string {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return current;
  if (!current.trim()) return trimmedAddition;
  return `${current.replace(/\s+$/, "")} ${trimmedAddition}`;
}
