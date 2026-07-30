import { Inbox, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

import { CommandButton } from "../primitives";

export type AsyncStateKind = "loading" | "empty" | "error";

export function AsyncState({
  kind,
  title,
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  kind: AsyncStateKind;
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const Icon = kind === "error"
    ? TriangleAlert
    : kind === "empty"
      ? Inbox
      : LoaderCircle;
  return (
    <div
      className={`async-state async-state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-busy={kind === "loading" || undefined}
    >
      <Icon size={24} aria-hidden="true" />
      <div className="async-state-copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <CommandButton icon={RotateCcw} onClick={onRetry}>
          {retryLabel}
        </CommandButton>
      ) : null}
    </div>
  );
}
