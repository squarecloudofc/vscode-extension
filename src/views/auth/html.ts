import { randomBytes } from "node:crypto";
import { t } from "vscode-ext-localisation";

import { EXTENSION_SCOPES } from "@/lib/api-key/authorize";

import codeExpired from "../../../resources/illustrations/code-expired.svg";
import error from "../../../resources/illustrations/error.svg";
import hero from "../../../resources/illustrations/hero.svg";
import keyLimit from "../../../resources/illustrations/key-limit.svg";
import offline from "../../../resources/illustrations/offline.svg";
import outage from "../../../resources/illustrations/outage.svg";
import rateLimit from "../../../resources/illustrations/rate-limit.svg";
import session from "../../../resources/illustrations/session.svg";
import success from "../../../resources/illustrations/success.svg";
import { escapeHtml, illustration, squareLogo, squareStyles } from "../shared";

/**
 * The whole view in one document: every step lives in the DOM and the host
 * swaps between them with `data-step`, so nothing re-renders (and the code
 * never blinks while the user is typing it on the page).
 *
 * It starts on `starting` — a spinner — because the host only knows whether
 * there is a key after an async read, and flashing "Connect account" at
 * someone who is already connected looks broken.
 */
export function renderAuthView(locale: string): string {
  const nonce = randomBytes(16).toString("base64");
  const e = (key: string) => escapeHtml(t(key));
  // What went wrong, in a title; the host sends the details as the body.
  const titles = {
    expired: t("auth.expired.title"),
    offline: t("problem.offline.title"),
    rateLimit: t("problem.rateLimit.title"),
    outage: t("problem.outage.title"),
    session: t("problem.session.title"),
    error: t("problem.error.title"),
  };

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${squareStyles}${styles()}</style>
</head>
<body data-step="starting">
<main>
  <header class="brand">
    ${squareLogo}
    <h1>Square Cloud</h1>
    <span class="tag">${e("auth.brandTag")}</span>
  </header>
  <div class="hero">
    ${illustration(hero, "hero", t("auth.hero.alt"), "hero-art")}
  </div>

  <section data-for="choose" class="home">
    <h2 class="headline">${e("auth.home.title")}</h2>
    <p class="pitch">${e("auth.home.lede")}</p>
    <div class="alert info notice" id="notice" role="status" hidden>${INFO_ICON}<span id="notice-text"></span></div>
    <div class="actions">
      <button class="btn primary shine" data-send="connect">${SIGN_IN_ICON}${e("setApiKey.connect.label")}</button>
      <button class="btn" data-send="paste">${e("setApiKey.manual.label")}</button>
      <button class="btn tertiary" data-send="cancel" id="back" hidden>${e("setApiKey.panel.cancel")}</button>
    </div>
  </section>

  <div class="panel">
  <div class="stepper">
  <ol class="steps" aria-label="${e("auth.steps.label")}">
    <li data-n="1"><span class="bullet"><span class="num">1</span>${CHECK}</span><span class="step-label">${e("auth.steps.connect")}</span></li>
    <li data-n="2"><span class="bullet"><span class="num">2</span>${CHECK}</span><span class="step-label">${e("auth.steps.confirm")}</span></li>
    <li data-n="3"><span class="bullet"><span class="num">3</span>${CHECK}</span><span class="step-label">${e("auth.steps.done")}</span></li>
  </ol>
  <span class="track" aria-hidden="true"><span class="track-fill"></span></span>
  </div>

  <section data-for="starting">
    <span class="spinner"></span>
    <p class="fine">${e("auth.preparing")}</p>
  </section>

  <section data-for="waiting">
    <p class="label">${e("setApiKey.panel.codeLabel")}</p>
    <div class="slots" id="code" aria-hidden="true"></div>
    <span class="sr-only" id="code-sr"></span>
    <button class="btn outline sm copy" data-send="copy" id="copy">${COPY_ICON}<span>${e("auth.copy")}</span></button>
    <p class="fine" id="copy-status" aria-live="polite"
      data-idle="${e("setApiKey.panel.copyHint")}"
      data-done="${e("setApiKey.panel.copied")}">${e("setApiKey.panel.copyHint")}</p>
    <p class="fine">${e("setApiKey.connect.codeDetail")}</p>

    <div class="alert warning" id="warning" role="status" hidden>
      ${illustration(keyLimit, "keyLimit", t("illustration.keyLimit"))}
      ${illustration(rateLimit, "rateLimit", t("illustration.rateLimit"))}
      <strong id="warning-title"></strong>
      <span id="warning-text"></span>
      <button class="link" data-send="security" id="warning-action" hidden>${e("auth.warning.openSecurity")}</button>
    </div>

    <div class="timer">
      <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle class="ring-track" cx="18" cy="18" r="15.9155" />
        <circle class="ring-fill" id="ring" cx="18" cy="18" r="15.9155" pathLength="100" />
      </svg>
      <div class="timer-text">
        <span class="status">${e("setApiKey.panel.waitingHint")}</span>
        <span class="countdown" id="countdown"
          data-label="${e("setApiKey.panel.expiresIn")}"
          data-expired="${e("auth.expired.title")}"></span>
      </div>
    </div>

    <div class="actions">
      <button class="btn primary shine" data-send="open">${e("setApiKey.connect.open")}</button>
      <button class="btn" data-send="cancel">${e("setApiKey.panel.cancel")}</button>
    </div>
  </section>

  <section data-for="done">
    ${illustration(success, "success", t("auth.success.alt"), "state-art")}
    <p class="state-title" id="account"></p>
  </section>

  <section data-for="error">
    <div id="error-art">
      ${illustration(codeExpired, "expired", t("illustration.codeExpired"), "state-art")}
      ${illustration(offline, "offline", t("illustration.offline"), "state-art")}
      ${illustration(rateLimit, "rateLimit", t("illustration.rateLimit"), "state-art")}
      ${illustration(outage, "outage", t("illustration.outage"), "state-art")}
      ${illustration(session, "session", t("illustration.session"), "state-art")}
      ${illustration(error, "error", t("illustration.error"), "state-art")}
    </div>
    <div role="alert">
      <p class="state-title" id="error-title"></p>
      <p class="lede" id="error"></p>
      <p class="fine code" id="error-code"></p>
    </div>
    <div class="actions">
      <button class="btn primary" data-send="retry">${e("setApiKey.panel.retry")}</button>
      <button class="btn" data-send="paste">${e("setApiKey.manual.label")}</button>
    </div>
  </section>
  </div>

  <details class="perms">
    <summary>${CHEVRON}<span>${e("auth.scopes.title")}</span></summary>
    <ul>${permissions()}</ul>
    <p class="fine">${e("auth.scopes.footer")}</p>
  </details>

  <p class="tour">${e("auth.newHere")} <button class="link" data-send="tour">${e("auth.tour")}</button></p>

  <footer class="trust">${LOCK_ICON}<span>${e("auth.home.trust")}</span></footer>
</main>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const TITLES = ${JSON.stringify(titles)};

  /** Shows the one illustration in scope called name, hides the others. */
  function showArt(scope, name) {
    for (const art of scope.querySelectorAll(".sq-art")) {
      art.toggleAttribute("hidden", !art.classList.contains("il-" + name));
    }
  }

  for (const button of document.querySelectorAll("[data-send]")) {
    button.addEventListener("click", () =>
      vscode.postMessage({ type: button.dataset.send }),
    );
  }

  // "Copied!" is echoed here rather than round-tripped through the host, so
  // the feedback lands on the same click that asked for it.
  let revert;
  $("copy").addEventListener("click", () => {
    const status = $("copy-status");
    status.textContent = status.dataset.done;
    const slots = $("code");
    slots.classList.remove("pulse");
    void slots.offsetWidth; // restart the animation on a repeated click
    slots.classList.add("pulse");
    clearTimeout(revert);
    revert = setTimeout(() => { status.textContent = status.dataset.idle; }, 1800);
  });

  // One slot per character so they can cascade in — the code is the one thing
  // on screen the user has to read carefully.
  function renderCode(code) {
    const target = $("code");
    if (target.dataset.value === code) return false;
    target.dataset.value = code;
    // A leftover copy pulse would replace the new slots' entrance.
    target.classList.remove("pulse");
    target.replaceChildren(
      ...[...code].map((character, index) => {
        const slot = document.createElement("span");
        slot.className = "slot";
        slot.textContent = character;
        slot.style.animationDelay = index * 55 + "ms";
        return slot;
      }),
    );
    // Read out one character at a time instead of as a made-up word.
    $("code-sr").textContent = [...code].join(" ");
    return true;
  }

  // Runs off the grant's own expires_in. The ring reads "this is running out"
  // faster than digits do; the digits are there for precision.
  let ticking;
  function startCountdown(total, endsAt) {
    clearInterval(ticking);
    const ring = $("ring");
    const label = $("countdown");
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      const share = left / (total * 1000);
      ring.style.strokeDashoffset = String(100 - share * 100);
      ring.classList.toggle("low", share < 0.2);
      const seconds = Math.ceil(left / 1000);
      const time = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      label.textContent = left > 0
        ? label.dataset.label.replace("{{TIME}}", time)
        : label.dataset.expired;
      if (left <= 0) clearInterval(ticking);
    };
    tick();
    ticking = setInterval(tick, 1000);
  }

  const STEP_OF = { choose: 1, starting: 1, error: 1, waiting: 2, done: 3 };

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data.handover) {
      document.body.classList.add("handover");
      return;
    }
    document.body.classList.remove("handover");
    const { step } = data;

    if (data.code && renderCode(data.code) && data.expiresAt) {
      startCountdown(Number(data.expiresIn), Number(data.expiresAt));
    }
    if (step !== "waiting") clearInterval(ticking);
    if (data.account) $("account").textContent = data.account;

    // The picture and title say what kind of problem it is; the text, which
    // one. Kinds without their own (plan, notFound, ...) read as an error.
    if (data.error) $("error").textContent = data.error;
    const kind = TITLES[data.kind] ? data.kind : "error";
    showArt($("error-art"), kind);
    $("error-title").textContent = TITLES[kind];
    // Only an unexplained error shows its code, for a support ticket.
    $("error-code").textContent =
      kind === "error" && data.code && !String(data.error).includes(data.code) ? data.code : "";

    $("notice-text").textContent = data.notice ?? "";
    $("notice").hidden = !data.notice;
    $("back").hidden = !data.reconnecting;

    const warning = $("warning");
    warning.hidden = !data.warning;
    showArt(warning, data.warningKind);
    $("warning-title").textContent = data.warningTitle ?? "";
    $("warning-text").textContent = data.warning ?? "";
    $("warning-action").hidden = data.warningKind !== "keyLimit";

    const current = STEP_OF[step] ?? 1;
    for (const item of document.querySelectorAll(".steps li")) {
      const n = Number(item.dataset.n);
      const done = n < current || step === "done";
      item.classList.toggle("done", done);
      item.classList.toggle("current", n === current && !done);
      if (n === current && !done) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    }
    document.body.dataset.progress = String(step === "done" ? 3 : current);
    document.body.dataset.step = step;
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}

/**
 * EXTENSION_SCOPES in words. Several scopes share a sentence; a scope with no
 * sentence is listed as-is, so the explainer can never under-report what the
 * authorization grants.
 */
function permissions(): string {
  const sentences: Record<string, string> = {
    "account:read": t("auth.scopes.account"),
    "apps:read": t("auth.scopes.appsRead"),
    "apps:control": t("auth.scopes.appsControl"),
    "apps:deploy": t("auth.scopes.appsDeploy"),
    "apps:write": t("auth.scopes.appsWrite"),
    "envs:read": t("auth.scopes.envs"),
    "envs:write": t("auth.scopes.envs"),
    "snapshots:read": t("auth.scopes.snapshots"),
    "snapshots:write": t("auth.scopes.snapshots"),
    "databases:read": t("auth.scopes.databases"),
    "databases:write": t("auth.scopes.databases"),
    "databases:credentials": t("auth.scopes.databaseCredentials"),
    "workspaces:manage": t("auth.scopes.workspaces"),
  };
  const lines = new Set(EXTENSION_SCOPES.map((s) => sentences[s] ?? s));
  return Array.from(
    lines,
    (line) => `<li>${CHECK}${escapeHtml(line)}</li>`,
  ).join("");
}

const CHECK = `<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>`;
const COPY_ICON = `<svg class="stroke" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M3 10.5V3.8C3 3.3 3.3 3 3.8 3h6.7" /></svg>`;
const CHEVRON = `<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>`;
const SIGN_IN_ICON = `<svg class="stroke" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2h2.7c.7 0 1.3.6 1.3 1.3v9.4c0 .7-.6 1.3-1.3 1.3H10M6.7 11.3L10 8 6.7 4.7M10 8H2" /></svg>`;
const LOCK_ICON = `<svg class="stroke" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>`;
// Phosphor's Info, the icon the site's Alert uses.
const INFO_ICON = `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8 16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 8 8Zm-32-92a12 12 0 1 1 12 12 12 12 0 0 1-12-12Z"/></svg>`;

/**
 * Layout for the sign-in view; colours, buttons, alerts and motion come from
 * `squareStyles`. Sizes scale with `vw` because the viewport here IS the
 * sidebar, which the user can drag down to ~150px.
 */
function styles(): string {
  return `
  /* The home picture's faces, lit from above like the site's isometric art.
     High-contrast themes keep flat faces with VS Code's borders. */
  body { --hm-violet: var(--vscode-charts-purple, #b180d7); }
  body.vscode-dark {
    --hm-violet: oklch(0.702 0.183 293.541);
    --hm-pt: oklch(0.2 0.01 258);
    --hm-pl: oklch(0.16 0.008 258);
    --hm-pr: oklch(0.135 0.007 258);
    --hm-kt: oklch(0.34 0.014 257);
    --hm-kl: oklch(0.25 0.012 257);
    --hm-kr: oklch(0.205 0.01 257);
    --hm-edge: oklch(0.4 0.02 257);
    --hm-grid: oklch(0.3 0.012 257);
  }
  body.vscode-light {
    --hm-violet: oklch(0.541 0.281 293.009);
    --hm-pt: oklch(0.965 0.004 257);
    --hm-pl: oklch(0.9 0.008 257);
    --hm-pr: oklch(0.855 0.01 257);
    --hm-kt: oklch(1 0 0);
    --hm-kl: oklch(0.935 0.006 257);
    --hm-kr: oklch(0.885 0.008 257);
    --hm-edge: oklch(0.78 0.012 257);
    --hm-grid: oklch(0.86 0.008 257);
  }

  main {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(380px, 100% - 32px);
    min-height: 100vh;
    margin: 0 auto;
    padding: 16px 0 20px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .brand .sq-logo { width: 18px; height: 18px; }
  h1 { margin: 0; font-size: 14px; font-weight: 600; color: var(--sq-foreground); }
  .tag {
    padding: 2px 7px;
    border: 1px solid var(--sq-border);
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--sq-text-muted);
  }
  .hero { margin: 16px 0; }
  .hero-art {
    display: block;
    width: 100%;
    max-width: 320px;
    height: auto;
    margin: 0 auto;
    transition: max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
  }
  /* Once there is a code on screen the art steps back, so the code leads. */
  body[data-step="waiting"] .hero-art { max-width: 150px; opacity: 0.8; }
  body[data-step="done"] .hero,
  body[data-step="error"] .hero { display: none; }
  body[data-step="done"] .brand,
  body[data-step="error"] .brand { margin-bottom: 16px; }

  /* Home: the pitch under the picture, then the way in. */
  .home { text-align: center; }
  .headline {
    margin: 0;
    font-size: 22px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--sq-foreground);
    text-wrap: balance;
  }
  .pitch { margin: 6px 0 0; line-height: 1.55; color: var(--sq-text-secondary); text-wrap: pretty; }
  .home > * { animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .home > :nth-child(2) { animation-delay: 60ms; }
  .home > :nth-child(3) { animation-delay: 120ms; }
  .home > :nth-child(n + 4) { animation-delay: 180ms; }
  .home .actions { margin-top: 20px; }
  .home .btn { height: 44px; }
  .home .btn.primary { font-size: 14px; font-weight: 600; }

  /* The card on the dashboard's authorize page: rounded-lg, border, bg-card. */
  .panel {
    padding: 16px;
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius-lg);
    background: var(--sq-card);
    text-align: center;
  }
  body[data-step="choose"] .panel { display: none; }

  /* 1 → 2 → 3, styled like the dashboard's first-deploy steps. */
  .stepper { position: relative; margin: 0 0 18px; }
  body[data-step="error"] .stepper { display: none; }
  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps li {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    color: var(--sq-text-muted);
    transition: color 0.3s ease;
  }
  .bullet {
    position: relative;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--sq-border);
    background: var(--sq-card);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
  }
  .bullet .check { position: absolute; width: 14px; height: 14px; opacity: 0; transform: scale(0.4); transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .bullet .num { transition: opacity 0.2s ease; }
  .steps li.current, .steps li.done { color: var(--sq-foreground); }
  .steps li.current .bullet {
    color: var(--sq-primary-foreground);
    background: var(--sq-primary);
    border-color: var(--vscode-contrastActiveBorder, var(--sq-primary));
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--sq-blue) 15%, transparent);
  }
  .steps li.done .bullet {
    color: var(--sq-green-text);
    border-color: color-mix(in oklab, var(--sq-green) 40%, transparent);
    background: color-mix(in oklab, var(--sq-green) 10%, var(--sq-card));
  }
  .steps li.done .num { opacity: 0; }
  .steps li.done .check { opacity: 1; transform: none; }
  .track {
    position: absolute;
    top: 14px;
    left: calc(100% / 6);
    right: calc(100% / 6);
    height: 1px;
    background: var(--sq-border);
    overflow: hidden;
  }
  .track-fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--sq-green), var(--sq-blue));
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.5s cubic-bezier(0.65, 0, 0.35, 1);
  }
  body[data-progress="2"] .track-fill { transform: scaleX(0.5); }
  body[data-progress="3"] .track-fill { transform: scaleX(1); }

  section { display: none; }
  /* Going from display:none to block restarts the animation (and the shine),
     so each step arrives on its own instead of snapping into place. */
  body[data-step="choose"]   section[data-for="choose"],
  body[data-step="starting"] section[data-for="starting"],
  body[data-step="waiting"]  section[data-for="waiting"],
  body[data-step="done"]     section[data-for="done"],
  body[data-step="error"]    section[data-for="error"] {
    display: block;
    animation: rise 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .lede { margin: 0 0 14px; color: var(--sq-text-secondary); overflow-wrap: anywhere; }
  .label { margin: 0 0 10px; font-weight: 500; color: var(--sq-foreground); }
  .fine { margin: 12px 0 0; font-size: 12px; color: var(--sq-text-muted); }
  .actions { display: grid; gap: 8px; margin-top: 16px; }
  .actions .btn { width: 100%; }
  .notice { margin: 16px 0 0; text-align: left; }
  .notice > span { grid-row: span 2; align-self: center; }

  /* The code, like the site's pin input: mono slots on bg-muted, four and four. */
  .slots {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr)) clamp(0px, 1.5vw, 6px) repeat(4, minmax(0, 1fr));
    gap: clamp(2px, 1.2vw, 4px);
  }
  .slot {
    display: grid;
    place-items: center;
    aspect-ratio: 3 / 4;
    max-height: 44px;
    border-radius: var(--sq-radius);
    border: 1px solid var(--sq-border);
    background: var(--sq-muted);
    font-family: var(--sq-mono);
    font-size: clamp(12px, 5.6vw, 18px);
    font-weight: 600;
    color: var(--sq-foreground);
    animation: flip 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .slot:nth-child(5) { grid-column: 6; }
  @keyframes flip {
    from { opacity: 0; transform: translateY(-8px) scale(0.85); }
    to { opacity: 1; transform: none; }
  }
  .slots.pulse .slot { animation: ring 0.6s ease-out; }
  @keyframes ring {
    0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--sq-blue) 55%, transparent); border-color: var(--sq-blue); }
    100% { box-shadow: 0 0 0 6px transparent; }
  }
  .copy { margin-top: 12px; }
  svg.stroke, .check, .chevron {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  #copy-status { margin-top: 6px; }
  .alert { margin-top: 14px; animation: rise 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  /* The panel is narrow: the picture goes on top and the words get the width. */
  #warning { grid-template-columns: minmax(0, 1fr); justify-items: center; text-align: center; }
  #warning > * { grid-column: 1; }
  #warning > .sq-art { grid-row: auto; width: 96px; }
  #warning button.link { justify-self: center; }

  /* Runs down with the grant: a ring (the site's blue progress), and the time. */
  .timer {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: var(--sq-radius);
    border: 1px solid var(--sq-border);
    background: color-mix(in oklab, var(--sq-muted) 40%, transparent);
    text-align: left;
  }
  .ring { flex: none; width: 32px; height: 32px; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 3.2; }
  .ring-track { stroke: color-mix(in oklab, var(--sq-blue) 20%, transparent); }
  .ring-fill {
    stroke: var(--sq-blue);
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
  }
  .ring-fill.low { stroke: var(--sq-amber); }
  .timer-text { display: grid; gap: 2px; min-width: 0; }
  .countdown { font-size: 12px; color: var(--sq-text-muted); font-variant-numeric: tabular-nums; }
  .status { display: flex; gap: 7px; align-items: center; font-size: 12px; font-weight: 500; color: var(--sq-foreground); }
  section[data-for="starting"] .spinner { display: block; margin: 8px auto 0; }

  /* The picture for how it ended: success, or what went wrong. */
  .state-art { display: block; width: min(180px, 70%); height: auto; margin: 0 auto 10px; }
  .il-success.state-art { width: 104px; }
  .state-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--sq-foreground);
    overflow-wrap: anywhere;
    animation: rise 0.5s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  #error { margin: 6px 0 0; }
  .code { font-family: var(--sq-mono); }
  .code:empty { display: none; }

  /* Plain words for what the authorization allows, as a collapsible card. */
  .perms {
    display: none;
    margin-top: 12px;
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius-lg);
    background: var(--sq-card);
    text-align: left;
    font-size: 12px;
    color: var(--sq-text-secondary);
  }
  body[data-step="waiting"] .perms { display: block; }
  .perms summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--sq-radius-lg);
    list-style: none;
    font-size: 13px;
    font-weight: 500;
    color: var(--sq-foreground);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  .perms summary::-webkit-details-marker { display: none; }
  .perms summary:hover { background: var(--sq-accent); }
  .chevron { flex: none; width: 14px; height: 14px; color: var(--sq-text-muted); transition: transform 0.2s ease; }
  .perms[open] .chevron { transform: rotate(90deg); }
  .perms ul { margin: 0; padding: 4px 12px 0; list-style: none; display: grid; gap: 6px; }
  .perms li { display: flex; gap: 8px; }
  .perms .check { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--sq-green-text); stroke-width: 1.8; }
  .perms .fine { margin: 10px 12px 12px; padding-top: 10px; border-top: 1px solid var(--sq-border); }
  .perms[open] ul { animation: rise 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .tour { margin: 16px 0 24px; text-align: center; font-size: 12.5px; color: var(--sq-text-muted); }
  .tour button.link { text-decoration: none; }
  .tour button.link:hover { text-decoration: underline; }
  body[data-step="starting"] .tour,
  body[data-step="done"] .tour { display: none; }

  /* What connecting means, at the foot of the home. */
  .trust {
    display: none;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--sq-border);
    font-size: 11.5px;
    line-height: 1.5;
    text-align: center;
    text-wrap: pretty;
    color: var(--sq-text-muted);
  }
  body[data-step="choose"] .trust { display: block; }
  .trust svg { width: 13px; height: 13px; margin-right: 5px; vertical-align: -2px; }

  /* Plays just before the host swaps the sidebar over. */
  body.handover main { animation: handover 0.36s ease-in forwards; }
  @keyframes handover {
    to { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
  `;
}
