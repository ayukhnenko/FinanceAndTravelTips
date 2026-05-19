"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

const remoteUrl = "https://www.fcalc.app/api/mcp";

export default function McpDocsPage() {
  const { tr } = useI18n();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {tr("Техническая документация MCP", "MCP Technical Documentation")}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {tr(
          "Эта страница описывает MCP сервер проекта, его назначение, точки подключения и доступные инструменты.",
          "This page describes the project MCP server, its purpose, connection endpoints, and available tools."
        )}
      </p>

      <section className="card-panel mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("Назначение", "Purpose")}
        </h2>
        <p className="text-sm text-[var(--foreground)]">
          {tr(
            "MCP сервер предоставляет машинно-читаемое описание API калькуляторов. Он анализирует роуты в app/api и позволяет получать краткую или JSON-версию документации.",
            "The MCP server provides machine-readable API documentation for calculators. It analyzes routes in app/api and returns either summary or JSON documentation."
          )}
        </p>
      </section>

      <section className="card-panel mt-4 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("Точки подключения", "Connection Endpoints")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
          <li>
            <code>{remoteUrl}</code> -{" "}
            {tr("публичный production endpoint", "public production endpoint")}
          </li>
        </ul>
      </section>

      <section className="card-panel mt-4 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("Характеристики сервера", "Server Characteristics")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
          <li>
            <strong>{tr("Имя", "Name")}:</strong>{" "}
            <code>loan-payment-api-docs-http</code>
          </li>
          <li>
            <strong>{tr("Версия", "Version")}:</strong> <code>1.0.0</code>
          </li>
          <li>
            <strong>{tr("Транспорт", "Transport")}:</strong>{" "}
            {tr("MCP Streamable HTTP", "MCP Streamable HTTP")}
          </li>
          <li>
            <strong>{tr("Режим", "Mode")}:</strong>{" "}
            {tr(
              "stateless, JSON-ответы для tool-вызовов",
              "stateless, JSON responses for tool calls"
            )}
          </li>
          <li>
            <strong>{tr("Среда исполнения", "Runtime")}:</strong>{" "}
            <code>nodejs</code>
          </li>
        </ul>
      </section>

      <section className="card-panel mt-4 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("Доступные инструменты", "Available Tools")}
        </h2>
        <p className="text-sm text-[var(--foreground)]">
          <code>get_api_description</code>
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
          <li>
            <code>format</code>: <code>summary</code> | <code>json</code>{" "}
            ({tr("по умолчанию", "default")} <code>summary</code>)
          </li>
          <li>
            <code>pathFilter</code>:{" "}
            {tr(
              "необязательный фильтр по части пути, например /auth",
              "optional endpoint path substring filter, for example /auth"
            )}
          </li>
        </ul>
      </section>

      <section className="card-panel mt-4 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("Где реализовано", "Implementation Paths")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
          <li>
            <code>app/api/mcp/route.ts</code> -{" "}
            {tr(
              "HTTP endpoint для деплоя в интернет",
              "HTTP endpoint for internet deployment"
            )}
          </li>
          <li>
            <code>scripts/mcp-api-docs.mjs</code> -{" "}
            {tr(
              "локальный stdio MCP сервер для Cursor",
              "local stdio MCP server for Cursor"
            )}
          </li>
          <li>
            <code>.cursor/mcp.json</code> -{" "}
            {tr(
              "конфигурация локального MCP подключения в Cursor",
              "local MCP connection config for Cursor"
            )}
          </li>
        </ul>
      </section>

      <div className="mt-6">
        <Link href="/api-docs" className="link-accent text-sm">
          {tr("Перейти к описанию REST API", "Go to REST API docs")}
        </Link>
      </div>
    </div>
  );
}
