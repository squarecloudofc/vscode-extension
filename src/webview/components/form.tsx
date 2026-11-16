import type { ComponentChildren, JSX } from "preact";

import type { IconName } from "../icons";
import { cx } from "../lib/cx";
import { Icon } from "./icon";

export type InputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "icon"
> & {
  /** Leading icon, e.g. magnifying-glass for a filter. */
  icon?: IconName;
  invalid?: boolean;
  /** Trailing content inside the field (a unit, an IconButton). */
  end?: ComponentChildren;
};

/** A 36 px text field; the ring sits on the frame, not the input. */
export function Input({
  icon,
  invalid,
  end,
  class: className,
  ...rest
}: InputProps) {
  return (
    <label
      class={cx("field", className as string)}
      data-invalid={invalid ? "" : undefined}
    >
      {icon ? <Icon name={icon} /> : null}
      <input {...rest} aria-invalid={invalid || undefined} />
      {end}
    </label>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<
  JSX.SelectHTMLAttributes<HTMLSelectElement>,
  "value"
> & {
  options: readonly SelectOption[];
  value?: string;
};

/** The native select (keyboard and screen readers built in), in the site's frame. */
export function Select({ options, class: className, ...rest }: SelectProps) {
  return (
    <span class={cx("select", className as string)}>
      <select {...rest}>
        {options.map((option) => (
          <option
            disabled={option.disabled}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="caret-down" />
    </span>
  );
}
