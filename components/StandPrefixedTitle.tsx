import { getAppStandLabel, standLabelClassName } from "@/lib/app-branding";

type StandPrefixedTitleProps = {
  title: string;
  className?: string;
  as?: "h1" | "h2";
};

export default function StandPrefixedTitle({
  title,
  className = "text-2xl font-bold text-[var(--foreground)]",
  as: Tag = "h1",
}: StandPrefixedTitleProps) {
  const standLabel = getAppStandLabel();

  return (
    <Tag className={className}>
      {standLabel ? (
        <>
          <span className={standLabelClassName(standLabel)}>{standLabel}</span>
          <span className="text-[var(--muted)]"> · </span>
          {title}
        </>
      ) : (
        title
      )}
    </Tag>
  );
}
