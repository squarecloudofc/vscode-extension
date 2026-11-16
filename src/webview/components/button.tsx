import type { JSX } from "preact";

import type { IconName } from "../icons";
import { cx } from "../lib/cx";
import { Icon } from "./icon";
import { Tooltip } from "./overlay";

type ButtonBase = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "size" | "icon" | "type" | "disabled"
>;

export type ButtonProps = ButtonBase & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** 40, 36 or 32 px tall (the site's md, sm and xs). */
  size?: "md" | "sm" | "xs";
  icon?: IconName;
  /** In flight: disabled, announced as busy. No spinner (nothing loops). */
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function Button({
  variant = "primary",
  size = "sm",
  icon,
  busy,
  disabled,
  type = "button",
  class: className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      aria-busy={busy || undefined}
      class={cx("btn", `btn--${variant}`, `btn--${size}`, className as string)}
      disabled={disabled || busy}
      type={type}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<
  ButtonProps,
  "children" | "icon" | "size"
> & {
  icon: IconName;
  /** Its accessible name and tooltip. */
  label: string;
  /** 32 px (sm) or 36 px (md) square. */
  size?: "sm" | "md";
};

/** A square icon-only button, named by `label` and showing it on hover. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "sm",
  busy,
  disabled,
  type = "button",
  class: className,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={label} describe={false}>
      <button
        {...rest}
        aria-busy={busy || undefined}
        aria-label={label}
        class={cx(
          "btn",
          "btn--icon",
          `btn--${variant}`,
          size === "md" && "btn--md",
          className as string,
        )}
        disabled={disabled || busy}
        type={type}
      >
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}
