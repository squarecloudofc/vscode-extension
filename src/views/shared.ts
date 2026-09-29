export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] as string,
  );
}

/**
 * Inlines one of the `resources/illustrations` SVGs (bundled as text) so it
 * reads the theme's CSS variables, which an `<img>` never sees.
 *
 * An inline `<style>` is global to the whole document, so its classes are
 * prefixed with `il-<name>-` here — otherwise the SVG's `.ac` / `.o` and the
 * view's own CSS would restyle each other. The SVG's reduced-motion `*` rule is
 * scoped to the illustration for the same reason. Keyframe names are already
 * unique per file.
 */
export function illustration(
  svg: string,
  name: string,
  label: string,
  className = "",
): string {
  const scope = `il-${name}`;
  return svg
    .replace(/class="([^"]*)"/g, (_, classes: string) => {
      const scoped = classes
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => `${scope}-${c}`);
      return `class="${scoped.join(" ")}"`;
    })
    .replace(
      /<style>([\s\S]*?)<\/style>/,
      (_, css: string) =>
        // Only class selectors start with a dot followed by a letter — numbers
        // like `.45` or `1.12` in values never match.
        `<style>${css
          .replace(/\.([a-z])/gi, `.${scope}-$1`)
          .replace(/\*\{/g, `.${scope} *{`)}</style>`,
    )
    .replace(
      "<svg ",
      `<svg class="${scope} sq-art ${className}" role="img" aria-label="${escapeHtml(label)}" focusable="false" `,
    );
}

/** Phosphor's WarningCircle, the icon the site's Alert uses. */
export const warningIcon = `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12 12 12 0 0 1 12 12Z"/></svg>`;

/** The Square Cloud mark (the website's `assets/logo.svg`), in currentColor. */
export const squareLogo = `<svg class="sq-logo" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path fill="currentColor" d="M125.741 64.755H448v320.75h-61.741v61.74H64v-320.75h61.741zm19.577 19.576v42.164h240.941v239.433h42.165V84.331zM89.6 152.095v269.551h269.553V152.095z"/><path fill="currentColor" d="M125.741 159.624h19.577v206.304h206.306v19.577H125.741z"/></svg>`;

/**
 * The website's look, shared by both webviews: its design tokens
 * (`packages/tailwind-config/colors.css`, Tailwind's palette for the blues,
 * greens and ambers) and the few components both views draw.
 *
 * Picked by the class VS Code puts on <body>. `vscode-dark` and `vscode-light`
 * get Square's dark and light themes; high-contrast themes (and anything
 * unknown) keep VS Code's own colours and borders, because there
 * accessibility wins over the brand.
 */
export const squareStyles = `
  body {
    --sq-background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    --sq-foreground: var(--vscode-foreground);
    --sq-card: var(--sq-background);
    --sq-popover: var(--vscode-editorHoverWidget-background, var(--sq-background));
    --sq-accent: var(--vscode-list-hoverBackground, transparent);
    --sq-muted: transparent;
    --sq-secondary: var(--vscode-button-secondaryBackground, transparent);
    --sq-border: var(--vscode-contrastBorder, var(--vscode-widget-border));
    --sq-input: var(--sq-background);
    --sq-text-primary: var(--vscode-foreground);
    --sq-text-secondary: var(--vscode-foreground);
    --sq-text-muted: var(--vscode-descriptionForeground);
    --sq-text-link: var(--vscode-textLink-foreground);
    --sq-primary: var(--vscode-button-background);
    --sq-primary-hover: var(--vscode-button-hoverBackground, var(--sq-primary));
    --sq-primary-foreground: var(--vscode-button-foreground);
    --sq-control-border: var(--vscode-button-border, var(--vscode-contrastBorder, transparent));
    --sq-ring: var(--vscode-focusBorder);
    --sq-shadow: var(--vscode-widget-shadow, transparent);
    --sq-blue: var(--vscode-textLink-foreground);
    --sq-green: var(--vscode-testing-iconPassed);
    --sq-green-text: var(--sq-green);
    --sq-red: var(--vscode-errorForeground);
    --sq-red-text: var(--sq-red);
    --sq-amber: var(--vscode-editorWarning-foreground);
    --sq-amber-text: var(--sq-amber);
    --sq-warning: var(--sq-amber);
    --sq-warning-edge: var(--sq-amber);
    --sq-danger-edge: var(--sq-red);
    --sq-info-edge: var(--sq-blue);
    --sq-star: var(--vscode-charts-yellow, var(--sq-amber));
    --sq-radius: 8px;
    --sq-radius-lg: 12px;
    --sq-font: Inter, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
    --sq-mono: "Fira Mono", ui-monospace, var(--vscode-editor-font-family), monospace;
  }
  body.vscode-dark, body.vscode-light {
    --sq-primary: oklch(0.488 0.243 264.376);
    --sq-primary-hover: oklch(0.424 0.199 265.638);
    --sq-ring: oklch(0.488 0.243 264.376);
    --sq-control-border: transparent;
    --sq-blue: oklch(0.623 0.214 259.815);
    --sq-green: oklch(0.723 0.219 149.579);
    --sq-red: #e84b54;
    --sq-amber: oklch(0.769 0.188 70.08);
    --sq-warning-edge: oklch(0.852 0.199 91.936);
    --sq-danger-edge: #f3767d;
    --sq-info-edge: oklch(0.546 0.245 262.881);
    --sq-star: oklch(0.852 0.199 91.936);
  }
  body.vscode-dark {
    --sq-background: oklch(0.105 0.005 244.28);
    --sq-foreground: oklch(0.923 0.007 247.87);
    --sq-card: oklch(0.128 0.006 262.01);
    --sq-popover: oklch(0.128 0.006 262.01);
    --sq-accent: oklch(0.149 0.007 258.04);
    --sq-muted: oklch(0.177 0.007 258.37);
    --sq-secondary: oklch(0.269 0 0);
    --sq-border: oklch(0.189 0.008 248.23);
    --sq-input: oklch(0.128 0.006 262.01);
    --sq-text-primary: oklch(0.846 0.016 257.21);
    --sq-text-secondary: oklch(0.681 0.03 253.31);
    --sq-text-muted: oklch(0.65 0.025 257.51);
    --sq-text-link: oklch(0.707 0.165 254.624);
    --sq-primary-foreground: oklch(0.923 0.007 247.87);
    /* The site rings focus in blue-700, ~2.4:1 on this background; blue-500
       clears 3:1 so keyboard focus stays visible. */
    --sq-ring: oklch(0.623 0.214 259.815);
    --sq-shadow: oklch(0.128 0.006 262.01);
    --sq-green-text: oklch(0.723 0.219 149.579);
    --sq-red-text: #f3767d;
    --sq-amber-text: oklch(0.828 0.189 84.429);
    --sq-warning: oklch(0.795 0.184 86.047);
  }
  body.vscode-light {
    --sq-background: oklch(1 0 0);
    --sq-foreground: oklch(0.105 0.005 244.28);
    --sq-card: oklch(0.985 0.001 264);
    --sq-popover: oklch(1 0 0);
    --sq-accent: oklch(0.92 0.003 257);
    --sq-muted: oklch(0.96 0.002 264);
    --sq-secondary: oklch(0.92 0.003 257);
    --sq-border: oklch(0.92 0.003 257);
    --sq-input: oklch(1 0 0);
    --sq-text-primary: oklch(0.128 0.006 262.01);
    --sq-text-secondary: oklch(0.149 0.007 258.04);
    --sq-text-muted: oklch(0.47 0.013 257);
    --sq-text-link: oklch(0.488 0.243 264.376);
    --sq-primary-foreground: oklch(1 0 0);
    --sq-shadow: rgba(15, 23, 42, 0.08);
    /* green-500 is ~2:1 on white; green-700 is the site's accessible pick. */
    --sq-green-text: oklch(0.527 0.154 150.069);
    --sq-red-text: #d52d37;
    --sq-amber-text: oklch(0.555 0.163 48.998);
    --sq-warning: oklch(0.554 0.135 66.442);
  }
  /* The illustrations colour themselves with VS Code's variables; inside the
     Square themes they get Square's colours instead. */
  body.vscode-dark .sq-art, body.vscode-light .sq-art {
    --vscode-editor-background: var(--sq-card);
    --vscode-widget-border: var(--sq-border);
    --vscode-foreground: var(--sq-text-secondary);
    --vscode-textLink-foreground: var(--sq-blue);
    --vscode-testing-iconPassed: var(--sq-green);
    --vscode-editorWarning-foreground: var(--sq-amber);
    --vscode-errorForeground: var(--sq-red);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--sq-font);
    font-size: 13px;
    line-height: 1.45;
    color: var(--sq-text-primary);
    background: var(--sq-background);
    -webkit-font-smoothing: antialiased;
    /* The sidebar scrolls vertically; nothing here should ever scroll sideways. */
    overflow-x: hidden;
  }
  [hidden] { display: none !important; }
  .muted { color: var(--sq-text-muted); }
  .sq-logo { display: block; flex: none; width: 22px; height: 22px; color: var(--sq-foreground); }
  :focus-visible { outline: 2px solid var(--sq-ring); outline-offset: 2px; }

  /* Button: packages/ui buttons/button.tsx. */
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    overflow: hidden;
    border: 1px solid var(--sq-control-border);
    border-radius: var(--sq-radius);
    font: 500 13px/1 var(--sq-font);
    white-space: nowrap;
    cursor: pointer;
    color: var(--sq-foreground);
    background: var(--sq-secondary);
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .btn:hover { background: color-mix(in oklab, var(--sq-secondary) 80%, transparent); }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.5; pointer-events: none; }
  .btn.sm { height: 36px; padding: 0 12px; font-weight: 400; }
  .btn svg { width: 16px; height: 16px; flex: none; fill: currentColor; }
  .btn.primary { color: var(--sq-primary-foreground); background: var(--sq-primary); }
  .btn.primary:hover { background: var(--sq-primary-hover); }
  .btn.outline {
    background: var(--sq-background);
    box-shadow: 0 0 0 1px var(--sq-border);
    border-color: transparent;
  }
  .btn.outline:hover, .btn.tertiary:hover { background: var(--sq-accent); color: var(--sq-foreground); }
  .btn.tertiary { background: transparent; color: var(--sq-text-secondary); }
  /* Three slow sweeps, then rest (an endless loop costs CPU for nothing). */
  .btn.shine::after {
    content: "";
    position: absolute;
    inset: -50% 0;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 40%, color-mix(in oklab, var(--sq-foreground) 10%, transparent) 50%, transparent 60%);
    filter: blur(10px);
    animation: shine 3.5s ease-in-out 3 both;
  }
  @keyframes shine { from { transform: translateX(-120%); } to { transform: translateX(120%); } }

  /* Badge: data-display/badge.tsx (soft tint, rounded-sm, h-5). */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* LoadingSpinner: feedback/loading-spinner.tsx. */
  .spinner {
    display: inline-block;
    flex: none;
    width: 20px;
    height: 20px;
    border: 2px solid color-mix(in oklab, var(--sq-blue) 25%, transparent);
    border-left-color: var(--sq-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Skeleton: feedback/skeleton.tsx. */
  .skeleton {
    position: relative;
    display: block;
    overflow: hidden;
    border-radius: var(--sq-radius);
    background: color-mix(in oklab, var(--sq-foreground) 10%, transparent);
  }
  .skeleton::before {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--sq-foreground) 20%, transparent), transparent);
    animation: shimmer 2s infinite;
  }
  @keyframes shimmer { to { transform: translateX(200%); } }

  /* Alert: utilities/alert.tsx, size sm. */
  .alert {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 12px;
    padding: 12px;
    border: 1px solid var(--edge);
    border-radius: var(--sq-radius);
    background: color-mix(in oklab, var(--edge) 6%, var(--sq-background));
    text-align: left;
    font-size: 12px;
    color: var(--sq-text-secondary);
    overflow-wrap: anywhere;
  }
  .alert > :not(svg) { grid-column: 2; }
  .alert > svg { grid-row: span 2; width: 18px; height: 18px; fill: var(--tone); }
  .alert strong { font-size: 13px; font-weight: 500; color: var(--tone); }
  .alert.warning { --edge: var(--sq-warning-edge); --tone: var(--sq-warning); }
  .alert.danger { --edge: var(--sq-danger-edge); --tone: var(--sq-red-text); }
  .alert.info { --edge: var(--sq-info-edge); --tone: var(--sq-text-link); }
  /* Led by an illustration instead of an icon, when the picture says more. */
  .alert > .sq-art { grid-row: span 3; align-self: center; width: 72px; height: auto; fill: none; }

  /* An inline text action, like the site's underlined links. */
  button.link {
    justify-self: start;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: 500;
    color: var(--sq-text-link);
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }
  button.link:disabled { opacity: 0.5; pointer-events: none; }

  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.75); }
    to { opacity: 1; transform: none; }
  }

  /* Japanese has no spaces, so titles broke mid-word ("ホスティン / グ").
     auto-phrase wraps between phrases instead; it only acts on lang="ja". */
  .headline, .state-title, .empty-title { word-break: auto-phrase; }

  /* Motion is decoration — every state reads without it. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      /* No staggered pop-in either: everything is simply there. */
      animation-delay: 0s !important;
      transition-duration: 0.001ms !important;
    }
    .btn.shine::after, .skeleton::before { display: none; }
    .spinner { animation-duration: 3s !important; animation-iteration-count: infinite !important; }
  }
`;
