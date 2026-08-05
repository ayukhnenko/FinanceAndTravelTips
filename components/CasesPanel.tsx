"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import CaseThread from "@/components/CaseThread";
import { appendTranscript } from "@/lib/speech-recognition-client";
import {
  caseStatusLabel,
  getGuestCaseToken,
  readGuestCaseAccessList,
  rememberGuestCaseAccess,
  type CaseMessageView,
} from "@/lib/cases-client";

const SpeechInputButton = dynamic(() => import("@/components/SpeechInputButton"), {
  ssr: false,
});
type UserCase = {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  title: string;
  body: string;
  status: "draft" | "submitted" | "answered";
  adminResponse: string | null;
  adminRespondedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CasesPanelProps = {
  isLoggedIn: boolean;
  userEmail?: string | null;
  initialCaseId?: string | null;
  initialGuestToken?: string | null;
};

const emptyForm = { title: "", body: "", email: "" };

export default function CasesPanel({
  isLoggedIn,
  userEmail,
  initialCaseId,
  initialGuestToken,
}: CasesPanelProps) {
  const [cases, setCases] = useState<UserCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialCaseId ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    email: userEmail ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [messages, setMessages] = useState<CaseMessageView[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedId) ?? null,
    [cases, selectedId]
  );

  const guestHeaders = useCallback(
    (caseId: string): HeadersInit => {
      const token = getGuestCaseToken(caseId) ?? initialGuestToken ?? "";
      return token ? { "X-Case-Access-Token": token } : {};
    },
    [initialGuestToken]
  );

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      if (isLoggedIn) {
        const resp = await fetch("/api/cases");
        const data = (await resp.json().catch(() => ({}))) as {
          cases?: UserCase[];
          error?: string;
        };
        if (!resp.ok) {
          setError(data.error ?? "Не удалось загрузить кейсы");
          return;
        }
        setCases(data.cases ?? []);
        return;
      }

      if (initialCaseId && initialGuestToken) {
        rememberGuestCaseAccess(initialCaseId, initialGuestToken);
      }

      const access = readGuestCaseAccessList();
      if (access.length === 0) {
        setCases([]);
        return;
      }

      const resp = await fetch("/api/cases/guest-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        cases?: UserCase[];
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось загрузить кейсы");
        return;
      }
      setCases(data.cases ?? []);
    } catch {
      setError("Не удалось загрузить кейсы");
    } finally {
      setLoading(false);
    }
  }, [initialCaseId, initialGuestToken, isLoggedIn]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!initialCaseId || cases.length === 0) return;
    if (cases.some((item) => item.id === initialCaseId)) {
      setSelectedId(initialCaseId);
      setCreating(false);
    }
  }, [initialCaseId, cases]);

  useEffect(() => {
    if (!selectedCase || creating) return;
    setForm({
      title: selectedCase.title,
      body: selectedCase.body,
      email: selectedCase.guestEmail ?? userEmail ?? "",
    });
    setFollowUp("");
  }, [selectedCase, creating, userEmail]);

  const loadCaseDetail = useCallback(
    async (caseId: string) => {
      setDetailLoading(true);
      try {
        const resp = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
          headers: guestHeaders(caseId),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          case?: UserCase;
          messages?: CaseMessageView[];
          error?: string;
        };
        if (!resp.ok) {
          setError(data.error ?? "Не удалось загрузить кейс");
          return;
        }
        if (data.case) {
          setCases((current) =>
            current.map((item) => (item.id === data.case!.id ? data.case! : item))
          );
        }
        setMessages(data.messages ?? []);
      } catch {
        setError("Не удалось загрузить кейс");
      } finally {
        setDetailLoading(false);
      }
    },
    [guestHeaders]
  );

  useEffect(() => {
    if (!selectedId || creating) {
      setMessages([]);
      return;
    }
    void loadCaseDetail(selectedId);
  }, [selectedId, creating, loadCaseDetail]);

  function openCreate() {
    setSelectedId(null);
    setCreating(true);
    setForm({ ...emptyForm, email: userEmail ?? "" });
    setError(null);
    setInfo(null);
  }

  function openCase(item: UserCase) {
    setSelectedId(item.id);
    setCreating(false);
    setError(null);
    setInfo(null);
  }

  async function handleSaveDraft(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      if (creating || !selectedId) {
        const resp = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isLoggedIn
              ? { title: form.title, body: form.body }
              : form
          ),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          case?: UserCase;
          accessToken?: string;
          error?: string;
        };
        if (!resp.ok) {
          setError(data.error ?? "Не удалось создать кейс");
          return;
        }
        if (!isLoggedIn && data.case && data.accessToken) {
          rememberGuestCaseAccess(data.case.id, data.accessToken);
        }
        await loadCases();
        if (data.case) {
          setSelectedId(data.case.id);
          setCreating(false);
        }
        setInfo("Черновик сохранён");
        return;
      }

      const resp = await fetch(`/api/cases/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...guestHeaders(selectedId),
        },
        body: JSON.stringify(
          isLoggedIn
            ? { title: form.title, body: form.body }
            : form
        ),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось сохранить кейс");
        return;
      }
      await loadCases();
      setInfo("Черновик сохранён");
    } catch {
      setError("Не удалось сохранить кейс");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmitForAnalysis() {
    if (!selectedId) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const resp = await fetch(`/api/cases/${encodeURIComponent(selectedId)}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...guestHeaders(selectedId),
        },
        body: JSON.stringify(isLoggedIn ? {} : { email: form.email }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить кейс");
        return;
      }
      await loadCases();
      setInfo(
        isLoggedIn
          ? "Кейс отправлен на анализ. Ответ придёт на e-mail."
          : "Кейс отправлен на анализ. Ответ придёт на e-mail; для переписки с аналитиком зарегистрируйтесь в приложении."
      );
    } catch {
      setError("Не удалось отправить кейс");
    } finally {
      setPending(false);
    }
  }

  async function handleSendFollowUp(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const resp = await fetch(`/api/cases/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...guestHeaders(selectedId),
        },
        body: JSON.stringify({ message: followUp }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить сообщение");
        return;
      }
      setFollowUp("");
      await loadCases();
      await loadCaseDetail(selectedId);
      setInfo("Сообщение отправлено аналитику");
    } catch {
      setError("Не удалось отправить сообщение");
    } finally {
      setPending(false);
    }
  }

  const canEdit = creating || selectedCase?.status === "draft";
  const canFollowUp = selectedCase?.status === "answered" && isLoggedIn;
  const showForm = creating || selectedCase !== null;
  const showThread = selectedCase && selectedCase.status !== "draft";

  return (
    <div className="mt-6 flex flex-col gap-4 md:flex-row">
      <aside className="w-full shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)] md:w-64">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Мои кейсы</h2>
          <button type="button" onClick={openCreate} className="btn-primary px-2.5 py-1.5 text-xs">
            Новый
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="mt-2 space-y-2 text-xs leading-snug text-[var(--muted)]">
            <p>
              Без регистрации оставьте e-mail — ответ аналитика придёт на почту, но продолжить
              переписку в приложении не получится.
            </p>
            <p>
              Удобнее{" "}
              <Link href="/account/register?from=/cases" className="text-[var(--link)] underline">
                зарегистрироваться
              </Link>
              : тогда ответ и дальнейший диалог будут доступны здесь. При регистрации телефон
              и другие личные данные указывать не обязательно.
            </p>
          </div>
        ) : null}

        <div className="mt-3 space-y-1">
          {loading ? (
            <p className="text-xs text-[var(--muted)]">Загрузка...</p>
          ) : cases.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Пока нет кейсов</p>
          ) : (
            cases.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openCase(item)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--accent-soft)]/40"
                  }`}
                >
                  <div className="truncate text-xs font-medium text-[var(--foreground)]">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {caseStatusLabel(item.status)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)]">
        {!showForm ? (
          <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-[var(--muted)]">
            Выберите кейс или создайте новый
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {creating ? "Новый кейс" : selectedCase?.title}
              </h2>
              {selectedCase ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Статус: {caseStatusLabel(selectedCase.status)}
                </p>
              ) : null}
            </div>

            {!isLoggedIn ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                  E-mail для ответа
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                  className="field-input w-full"
                  placeholder="you@example.com"
                  disabled={!canEdit || pending}
                  required
                />
              </div>
            ) : userEmail ? (
              <p className="text-xs text-[var(--muted)]">
                Ответ придёт на {userEmail}
              </p>
            ) : (
              <p className="text-xs text-amber-700">
                Чтобы получить ответ,{" "}
                <Link href="/account" className="underline">
                  укажите e-mail в профиле
                </Link>
                .
              </p>
            )}

            <div>
              <div className="mb-1 flex items-start justify-between gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-[var(--foreground)]">
                  Заголовок
                </label>
                {canEdit ? (
                  <SpeechInputButton
                    continuous={false}
                    disabled={pending}
                    onTranscript={(text) =>
                      setForm((current) => ({
                        ...current,
                        title: appendTranscript(current.title, text),
                      }))
                    }
                  />
                ) : null}
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                className="field-input w-full"
                placeholder="Кратко опишите ситуацию"
                disabled={!canEdit || pending}
                required
              />
            </div>

            <div>
              <div className="mb-1 flex items-start justify-between gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-[var(--foreground)]">
                  Описание финансовой ситуации для анализа
                </label>
                {canEdit ? (
                  <SpeechInputButton
                    disabled={pending}
                    onTranscript={(text) =>
                      setForm((current) => ({
                        ...current,
                        body: appendTranscript(current.body, text),
                      }))
                    }
                  />
                ) : null}
              </div>
              {canEdit ? (
                <div className="mb-3 space-y-3 text-xs leading-relaxed text-[var(--muted)]">
                  <p>
                    Можно надиктовать текст кнопкой «Надиктовать» — он будет расшифрован и сохранён
                    как обычный текст.
                  </p>
                  <p>
                    От того, насколько полным будет описание, зависит качество и скорость решения
                    задачи аналитиком, а также сумма, которую мы сможем помочь сэкономить.
                  </p>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3">
                    <p className="font-medium text-[var(--foreground)]">
                      Ключевые моменты, которые стоит описать:
                    </p>
                    <ol className="mt-2 list-decimal space-y-2 pl-4">
                      <li>
                        <span className="font-medium text-[var(--foreground)]">Цель.</span> Именно
                        для достижения цели выбираются решения — уделите время и подумайте, что
                        именно является целью вашего запроса. Для решения кейса должны быть
                        доступны финансы, которые стоит описать ниже: только те, которые вы готовы
                        использовать для достижения цели.
                      </li>
                      <li>
                        <span className="font-medium text-[var(--foreground)]">Деньги.</span>{" "}
                        Желательно описать суммы и ставки, под которые вложены деньги.
                      </li>
                      <li>
                        <span className="font-medium text-[var(--foreground)]">
                          Доступные финансовые активы
                        </span>{" "}
                        — акции, облигации.
                      </li>
                      <li>
                        <span className="font-medium text-[var(--foreground)]">Недвижимость</span>{" "}
                        в собственности или аренде.
                      </li>
                      <li>
                        <span className="font-medium text-[var(--foreground)]">
                          Кредиты и кредитные карты.
                        </span>
                      </li>
                      <li>
                        Получаете ли вы зарплату официально и платите ли 2-НДФЛ.
                      </li>
                    </ol>
                  </div>
                </div>
              ) : null}
              <textarea
                value={form.body}
                onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))}
                className="field-input min-h-[220px] w-full resize-y"
                placeholder="Опишите цель, доступные финансы, активы, недвижимость, кредиты и другие важные детали"
                disabled={!canEdit || pending}
                required
              />
            </div>

            {showThread ? (
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Переписка</h3>
                {detailLoading ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Загрузка переписки...</p>
                ) : (
                  <div className="mt-2">
                    <CaseThread
                      initialBody={selectedCase!.body}
                      initialAt={selectedCase!.submittedAt ?? selectedCase!.createdAt}
                      messages={messages}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {canFollowUp ? (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <label className="min-w-0 flex-1 text-xs font-medium text-[var(--foreground)]">
                      Ваше сообщение аналитику
                    </label>
                    <SpeechInputButton
                      disabled={pending}
                      onTranscript={(text) =>
                        setFollowUp((current) => appendTranscript(current, text))
                      }
                    />
                  </div>
                  <textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="field-input min-h-[120px] w-full resize-y"
                    placeholder="Уточните детали или задайте дополнительный вопрос"
                    disabled={pending}
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSendFollowUp()}
                  className="btn-primary disabled:opacity-60"
                >
                  {pending ? "Отправка..." : "Отправить сообщение"}
                </button>
              </div>
            ) : null}

            {selectedCase?.status === "submitted" ? (
              <p className="text-xs text-[var(--muted)]">
                {isLoggedIn
                  ? "Кейс на анализе. Когда аналитик ответит, вы сможете продолжить переписку."
                  : "Кейс на анализе. Ответ придёт на e-mail; для переписки с аналитиком зарегистрируйтесь в приложении."}
              </p>
            ) : null}

            {!isLoggedIn && selectedCase?.status === "answered" ? (
              <p className="text-xs text-[var(--muted)]">
                Ответ также отправлен на e-mail. Чтобы продолжить переписку,{" "}
                <Link href="/account/register?from=/cases" className="text-[var(--link)] underline">
                  зарегистрируйтесь
                </Link>
                .
              </p>
            ) : null}

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {info ? <p className="text-sm text-[var(--accent)]">{info}</p> : null}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSaveDraft()}
                  className="btn-primary disabled:opacity-60"
                >
                  {pending ? "Сохранение..." : "Сохранить черновик"}
                </button>
                {!creating && selectedId ? (
                  <button
                    type="button"
                    disabled={pending || (isLoggedIn && !userEmail)}
                    onClick={() => void handleSubmitForAnalysis()}
                    className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-60"
                  >
                    Отправить на анализ
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
