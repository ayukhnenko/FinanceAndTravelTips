"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import CaseThread from "@/components/CaseThread";
import { caseStatusLabel, type CaseMessageView } from "@/lib/cases-client";
import { formatTimeMoscow } from "@/lib/date-utils";

type UserCase = {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  title: string;
  body: string;
  status: "draft" | "submitted" | "answered";
  adminResponse: string | null;
  adminRespondedAt: string | null;
  adminRespondedBy: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorLogin: string | null;
  authorName: string | null;
};

type FilterStatus = "all" | "submitted" | "answered";

type AdminCasesPanelProps = {
  initialCaseId?: string | null;
};

function authorLabel(item: UserCase): string {
  if (item.authorName?.trim()) return item.authorName.trim();
  if (item.authorLogin) return `@${item.authorLogin}`;
  if (item.guestEmail) return item.guestEmail;
  return "Пользователь";
}

export default function AdminCasesPanel({ initialCaseId }: AdminCasesPanelProps) {
  const [cases, setCases] = useState<UserCase[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(initialCaseId ?? null);
  const [response, setResponse] = useState("");
  const [messages, setMessages] = useState<CaseMessageView[]>([]);
  const [canRespond, setCanRespond] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedId) ?? null,
    [cases, selectedId]
  );

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/cases?status=${encodeURIComponent(filter)}`);
      const data = (await resp.json().catch(() => ({}))) as {
        cases?: UserCase[];
        error?: string;
      };
      if (resp.status === 401 || resp.status === 403) {
        window.location.href = "/account/login?from=/admin/cases";
        return;
      }
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
  }, [filter]);

  const loadCaseDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    try {
      const resp = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}`);
      const data = (await resp.json().catch(() => ({}))) as {
        case?: UserCase;
        messages?: CaseMessageView[];
        canRespond?: boolean;
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
      setCanRespond(Boolean(data.canRespond));
    } catch {
      setError("Не удалось загрузить кейс");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!initialCaseId || cases.length === 0) return;
    if (cases.some((item) => item.id === initialCaseId)) {
      setSelectedId(initialCaseId);
    }
  }, [initialCaseId, cases]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setCanRespond(false);
      return;
    }
    setResponse("");
    void loadCaseDetail(selectedId);
  }, [selectedId, loadCaseDetail]);

  async function handleRespond(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const resp = await fetch(`/api/admin/cases/${encodeURIComponent(selectedId)}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить ответ");
        return;
      }
      setResponse("");
      setInfo("Ответ отправлен пользователю на e-mail");
      await loadCases();
      await loadCaseDetail(selectedId);
    } catch {
      setError("Не удалось отправить ответ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Кейсы на анализ</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Просматривайте отправленные кейсы и ведите переписку с пользователями.
          </p>
        </div>
        <Link href="/admin/settings" className="btn-primary px-3 py-2">
          Настройки
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["submitted", "answered", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filter === value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {value === "submitted"
              ? "На анализе"
              : value === "answered"
                ? "С ответом"
                : "Все"}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row">
        <aside className="w-full shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)] md:w-72">
          {loading ? (
            <p className="text-xs text-[var(--muted)]">Загрузка...</p>
          ) : cases.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Нет кейсов</p>
          ) : (
            <div className="space-y-1">
              {cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    item.id === selectedId
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--input-bg)]"
                  }`}
                >
                  <div className="truncate text-xs font-medium text-[var(--foreground)]">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {caseStatusLabel(item.status)}
                    {item.authorLogin ? ` · @${item.authorLogin}` : ""}
                    {item.guestEmail ? ` · ${item.guestEmail}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)]">
          {!selectedCase ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-[var(--muted)]">
              Выберите кейс
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">{selectedCase.title}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {authorLabel(selectedCase)}
                  {selectedCase.guestEmail ? ` · ${selectedCase.guestEmail}` : ""}
                  {selectedCase.submittedAt
                    ? ` · отправлен ${formatTimeMoscow(selectedCase.submittedAt)}`
                    : ""}
                  {` · ${caseStatusLabel(selectedCase.status)}`}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Переписка</h3>
                {detailLoading ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Загрузка переписки...</p>
                ) : (
                  <div className="mt-2">
                    <CaseThread
                      initialBody={selectedCase.body}
                      initialAt={selectedCase.submittedAt ?? selectedCase.createdAt}
                      authorLabel={authorLabel(selectedCase)}
                      userLabel={authorLabel(selectedCase)}
                      messages={messages}
                    />
                  </div>
                )}
              </div>

              {canRespond ? (
                <form onSubmit={handleRespond} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                      Ответ пользователю
                    </label>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      className="field-input min-h-[180px] w-full resize-y"
                      placeholder="Подготовьте разбор кейса или ответ на уточнение"
                      required
                    />
                  </div>

                  {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                  {info ? <p className="text-sm text-[var(--accent)]">{info}</p> : null}

                  <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
                    {pending ? "Отправка..." : "Отправить ответ"}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  {selectedCase.status === "answered"
                    ? "Ожидаем ответ пользователя."
                    : "Этот кейс ведёт другой аналитик."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
