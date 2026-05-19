export function openUiReportLink(href: string): void {
  if (typeof window === "undefined") return;
  window.location.href = href;
}
