import type { ComponentChildren } from "preact";

import type { IconName } from "../icons";
import { cx } from "../lib/cx";
import { Icon } from "./icon";

/** A 12 px card; `title` is an 11 px section label, `actions` sit across. */
export function Card({
  title,
  actions,
  flush = false,
  children,
  class: className,
}: {
  title?: ComponentChildren;
  actions?: ComponentChildren;
  /** No body padding (a table or chart edge to edge). */
  flush?: boolean;
  children?: ComponentChildren;
  class?: string;
}) {
  return (
    <section class={cx("card", className)}>
      {title || actions ? (
        <header class="card__header">
          <h2 class="label">{title}</h2>
          {actions ? <div class="card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {flush ? children : <div class="card__body">{children}</div>}
    </section>
  );
}

/** Stat cells on one hairline grid (never cards inside a card). */
export function StatGrid({
  columns,
  children,
  class: className,
}: {
  /** Columns at full width; two in a narrow panel. Default 4. */
  columns?: number;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <div class={cx("stat-wrap", className)}>
      <dl
        class="stat-grid"
        style={columns ? { "--cols": String(columns) } : undefined}
      >
        {children}
      </dl>
    </div>
  );
}

/** One StatGrid cell: label, the number in Fira Mono, then a bar or a trend. */
export function Stat({
  label,
  icon,
  value,
  unit,
  hint,
  dimmed,
  children,
}: {
  label: ComponentChildren;
  icon?: IconName;
  value: ComponentChildren;
  unit?: ComponentChildren;
  hint?: ComponentChildren;
  /** An action is running: the reading stays, at half strength. */
  dimmed?: boolean;
  /** Under the value: a UsageBar or a Sparkline. */
  children?: ComponentChildren;
}) {
  return (
    <div aria-busy={dimmed || undefined} class="stat">
      <dt class="label">
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </dt>
      <dd class="stat__value">
        {value}
        {unit ? <span class="stat__unit">{unit}</span> : null}
      </dd>
      {hint ? <dd class="stat__hint">{hint}</dd> : null}
      {children ? <dd class="stat__foot">{children}</dd> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  class: className,
}: {
  icon?: IconName;
  title: ComponentChildren;
  description?: ComponentChildren;
  action?: ComponentChildren;
  class?: string;
}) {
  return (
    <div class={cx("empty", className)}>
      {icon ? (
        <div class="empty__media">
          <Icon name={icon} size={24} />
        </div>
      ) : null}
      <div class="empty__text">
        <p class="empty__title">{title}</p>
        {description ? <p class="empty__description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** A placeholder block; `col` staggers the sweep by 120 ms per column. */
export function Skeleton({
  width = "100%",
  height = 16,
  col,
  class: className,
}: {
  width?: number | string;
  height?: number | string;
  col?: number;
  class?: string;
}) {
  return (
    <span
      aria-hidden="true"
      class={cx("skeleton", className)}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        "--sk-col": col === undefined ? undefined : String(col),
      }}
    />
  );
}

const ALERT_ICON: Record<AlertIntent, IconName> = {
  info: "info",
  success: "check-circle",
  warning: "warning-circle",
  danger: "warning-octagon",
};

type AlertIntent = "info" | "success" | "warning" | "danger";

export function Alert({
  intent = "info",
  title,
  icon,
  action,
  children,
  class: className,
}: {
  intent?: AlertIntent;
  title?: ComponentChildren;
  icon?: IconName;
  /** Buttons under the text (e.g. "Reconnect"). */
  action?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}) {
  return (
    <div
      class={cx("alert", `alert--${intent}`, className)}
      role={intent === "danger" || intent === "warning" ? "alert" : "status"}
    >
      <Icon name={icon ?? ALERT_ICON[intent]} size={20} />
      {title ? <p class="alert__title">{title}</p> : null}
      {children ? <div>{children}</div> : null}
      {action ? <div class="alert__action">{action}</div> : null}
    </div>
  );
}
