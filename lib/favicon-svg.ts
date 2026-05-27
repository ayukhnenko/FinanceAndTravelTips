const FAVICON_MUTED = "#5c6861";
const FAVICON_ACCENT = "#21a038";
const FAVICON_UNREAD_DOT = "#0091ea";
const FAVICON_BG = "#f6faf7";

function buildGridFaviconSvg(unread: boolean): string {
  const badge = unread
    ? `<circle cx="26" cy="4.5" r="6.5" fill="${FAVICON_UNREAD_DOT}" stroke="${FAVICON_BG}" stroke-width="2.5"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="${FAVICON_BG}"/>
  <rect x="7" y="7" width="8" height="8" rx="2" fill="${FAVICON_MUTED}"/>
  <rect x="17" y="7" width="8" height="8" rx="2" fill="${FAVICON_MUTED}"/>
  <rect x="7" y="17" width="8" height="8" rx="2" fill="${FAVICON_MUTED}"/>
  <rect x="17" y="17" width="8" height="8" rx="2" fill="${FAVICON_ACCENT}"/>
  ${badge}
</svg>`;
}

export function faviconHref(unread: boolean): string {
  return `data:image/svg+xml,${encodeURIComponent(buildGridFaviconSvg(unread))}`;
}

export function applyFavicon(unread: boolean): void {
  if (typeof document === "undefined") return;

  const href = faviconHref(unread);
  const links = document.querySelectorAll<HTMLLinkElement>(
    "link[rel='icon'], link[rel='shortcut icon']"
  );

  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = href;
    document.head.appendChild(link);
    return;
  }

  Array.from(links).forEach((link) => {
    link.type = "image/svg+xml";
    link.href = href;
  });
}
