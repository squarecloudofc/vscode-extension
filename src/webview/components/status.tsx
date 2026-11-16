import type { ComponentChildren } from "preact";

import { cx } from "../lib/cx";

/** status-tone.ts: green Online, red Offline, amber in transition, muted unknown. */
export type Tone = "green" | "amber" | "red" | "blue" | "muted";

/**
 * The one way to show a status: a 6 px dot and its word, never a pill.
 * Amber breathes while something is in progress (the only looping motion).
 */
export function StatusDot({
  tone,
  label,
  pulse = tone === "amber",
  class: className,
}: {
  tone: Tone;
  label: ComponentChildren;
  pulse?: boolean;
  class?: string;
}) {
  return (
    <span class={cx("status", `status--${tone}`, className)}>
      <span
        aria-hidden="true"
        class={cx("status__dot", pulse && "status__dot--pulse")}
      />
      {label}
    </span>
  );
}

/** A short tag (plan, engine, "Pending"). Status itself is a StatusDot. */
export function Badge({
  tone = "outline",
  size = "md",
  children,
  class: className,
}: {
  tone?: "primary" | "success" | "warning" | "danger" | "purple" | "outline";
  size?: "md" | "sm";
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <span
      class={cx(
        "badge",
        `badge--${tone}`,
        size === "sm" && "badge--sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
