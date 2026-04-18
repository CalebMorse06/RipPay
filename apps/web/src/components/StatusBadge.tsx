import type { SessionStatus } from "@coldtap/shared";

const STYLES: Record<SessionStatus, { label: string; dot: string; text: string; ring: string }> = {
  CREATED:            { label: "Created",            dot: "bg-subtle",  text: "text-subtle",  ring: "ring-subtle/40" },
  AWAITING_BUYER:     { label: "Awaiting buyer",     dot: "bg-accent",  text: "text-accent",  ring: "ring-accent/40" },
  AWAITING_SIGNATURE: { label: "Awaiting signature", dot: "bg-warn",    text: "text-warn",    ring: "ring-warn/40" },
  SUBMITTED:          { label: "Submitted",          dot: "bg-warn",    text: "text-warn",    ring: "ring-warn/40" },
  VALIDATING:         { label: "Validating",         dot: "bg-warn",    text: "text-warn",    ring: "ring-warn/40" },
  PAID:               { label: "Paid",               dot: "bg-success", text: "text-success", ring: "ring-success/40" },
  FAILED:             { label: "Failed",             dot: "bg-danger",  text: "text-danger",  ring: "ring-danger/40" },
  EXPIRED:            { label: "Expired",            dot: "bg-subtle",  text: "text-subtle",  ring: "ring-subtle/40" },
};

const PULSE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "AWAITING_BUYER",
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "VALIDATING",
]);

export function StatusBadge({ status }: { status: SessionStatus }) {
  const s = STYLES[status];
  const shouldPulse = PULSE_STATUSES.has(status);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium ring-1 ${s.text} ${s.ring}`}
    >
      <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`}>
        {shouldPulse && (
          <span
            className={`absolute inset-0 inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-75`}
            aria-hidden
          />
        )}
      </span>
      {s.label}
    </span>
  );
}
