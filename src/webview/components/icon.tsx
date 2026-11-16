import { type IconName, iconPath } from "../icons";
import { cx } from "../lib/cx";
import { LOGO_MARK, logoUrl } from "../lib/logos";

/** A Phosphor icon in currentColor; `fill` for the active nav item. */
export function Icon({
  name,
  fill = false,
  size = 16,
  class: className,
}: {
  name: IconName;
  fill?: boolean;
  size?: number;
  class?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      class={cx("icon", className)}
      fill="currentColor"
      focusable="false"
      height={size}
      viewBox="0 0 256 256"
      width={size}
    >
      <path d={iconPath(name, fill)} />
    </svg>
  );
}

/**
 * An app's runtime or a database's engine, as the site's logo. An unknown
 * value gets a neutral square with the section's icon instead of a hole.
 */
export function Logo({
  kind,
  value,
  size = 16,
  class: className,
}: {
  kind: "app" | "database";
  value: string | null | undefined;
  size?: number;
  class?: string;
}) {
  const src = logoUrl(kind, value);
  if (src)
    return (
      <img
        alt=""
        class={cx("logo", className)}
        height={size}
        src={src}
        width={size}
      />
    );
  return (
    <span
      aria-hidden="true"
      class={cx("logo", "logo--fallback", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Icon
        name={kind === "app" ? "squares-four" : "database"}
        size={Math.round(size * 0.75)}
      />
    </span>
  );
}

/** The Square Cloud mark (the site's logo-mark.tsx), one path in currentColor. */
export function LogoMark({
  size = 16,
  class: className,
}: {
  size?: number;
  class?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      class={cx("icon", className)}
      focusable="false"
      height={size}
      viewBox="0 0 512 512"
      width={size}
    >
      <path d={LOGO_MARK} fill="currentColor" />
    </svg>
  );
}
