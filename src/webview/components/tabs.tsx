import type { JSX } from "preact";

import type { IconName } from "../icons";
import { cx } from "../lib/cx";
import { Icon } from "./icon";

export type TabItem = {
  id: string;
  label: string;
  /** A nav icon: regular, filled while the tab is active. */
  icon?: IconName;
  disabled?: boolean;
  /** Shown on hover, e.g. why a range is unavailable. */
  title?: string;
};

/**
 * A row of tabs (`line`, a panel's sections) or a segmented control (`pill`,
 * e.g. 24 h / 7 d). Arrow keys move between tabs; the caller renders the
 * content for `value`.
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
  variant = "line",
  class: className,
}: {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  variant?: "line" | "pill";
  class?: string;
}) {
  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const at = enabled.findIndex((item) => item.id === value);
    const next =
      event.key === "ArrowRight"
        ? enabled[(at + 1) % enabled.length]
        : event.key === "ArrowLeft"
          ? enabled[(at - 1 + enabled.length) % enabled.length]
          : event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled.at(-1)
              : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)
      ?.focus();
  };

  return (
    <div
      aria-label={label}
      class={cx("tabs", variant === "pill" && "tabs--pill", className)}
      onKeyDown={onKeyDown}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            aria-selected={active}
            class="tab"
            data-tab={item.id}
            disabled={item.disabled}
            key={item.id}
            onClick={() => onChange(item.id)}
            role="tab"
            tabIndex={active ? 0 : -1}
            title={item.title}
            type="button"
          >
            {item.icon ? <Icon fill={active} name={item.icon} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
