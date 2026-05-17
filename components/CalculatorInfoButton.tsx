"use client";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

type Props = {
  label: string;
  onShowTooltip: (el: HTMLElement) => void;
  onHideTooltip: () => void;
  onOpen: () => void;
};

export default function CalculatorInfoButton({
  label,
  onShowTooltip,
  onHideTooltip,
  onOpen,
}: Props) {
  return (
    <button
      type="button"
      className="relative z-[60] flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
      aria-label={label}
      onMouseEnter={(e) => onShowTooltip(e.currentTarget)}
      onMouseLeave={onHideTooltip}
      onFocus={(e) => onShowTooltip(e.currentTarget)}
      onBlur={onHideTooltip}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHideTooltip();
        onOpen();
      }}
    >
      <InfoIcon className="pointer-events-none h-4 w-4" />
    </button>
  );
}
