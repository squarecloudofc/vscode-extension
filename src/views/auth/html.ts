import { randomBytes } from "node:crypto";
import { t } from "vscode-ext-localisation";

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

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${styles()}</style>
</head>
<body data-step="starting">
<div class="backdrop"></div>

<main>
  <header>
    ${logo()}
    <h1>Square Cloud</h1>
  </header>

  <section data-for="choose">
    <p class="lede">${escapeHtml(t("setApiKey.panel.subtitle"))}</p>
    <div class="actions">
      <button class="primary" data-send="connect">${escapeHtml(t("setApiKey.connect.label"))}</button>
    </div>
    <p class="fine">${escapeHtml(t("setApiKey.connect.detail"))}</p>
    <button class="link" data-send="paste">${escapeHtml(t("setApiKey.manual.label"))}</button>
  </section>

  <section data-for="starting">
    <div class="spinner"></div>
  </section>

  <section data-for="waiting">
    <p class="lede">${escapeHtml(t("setApiKey.panel.codeLabel"))}</p>
    <button class="code" data-send="copy" id="copy"
      aria-label="${escapeHtml(t("setApiKey.panel.copied"))}"><span id="code"></span></button>
    <p class="fine" id="copy-status"
      data-idle="${escapeHtml(t("setApiKey.panel.copyHint"))}"
      data-done="${escapeHtml(t("setApiKey.panel.copied"))}">${escapeHtml(t("setApiKey.panel.copyHint"))}</p>
    <p class="fine">${escapeHtml(t("setApiKey.connect.codeDetail"))}</p>
    <div class="actions">
      <button class="primary" data-send="open">${escapeHtml(t("setApiKey.connect.open"))}</button>
      <button data-send="cancel">${escapeHtml(t("setApiKey.panel.cancel"))}</button>
    </div>
    <p class="warning" id="warning" hidden></p>
    <p class="status"><span class="spinner small"></span>${escapeHtml(t("setApiKey.panel.waitingHint"))}</p>
    <div class="lifetime"><div class="lifetime-fill" id="lifetime"></div></div>
    <p class="fine countdown" id="countdown"
      data-label="${escapeHtml(t("setApiKey.panel.expiresIn"))}"></p>
  </section>

  <section data-for="done">
    <svg class="tick" viewBox="0 0 44 44" aria-hidden="true">
      <circle class="tick-ring" cx="22" cy="22" r="20" />
      <path class="tick-mark" d="M13.5 22.5l6 6 11-12" />
    </svg>
    <p class="lede" id="account"></p>
  </section>

  <section data-for="error">
    <div class="badge cross">!</div>
    <p class="lede" id="error"></p>
    <div class="actions">
      <button class="primary" data-send="retry">${escapeHtml(t("setApiKey.panel.retry"))}</button>
      <button data-send="paste">${escapeHtml(t("setApiKey.manual.label"))}</button>
    </div>
  </section>
</main>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  for (const button of document.querySelectorAll("[data-send]")) {
    button.addEventListener("click", () =>
      vscode.postMessage({ type: button.dataset.send }),
    );
  }

  // "Copied!" is echoed here rather than round-tripped through the host, so
  // the feedback lands on the same click that asked for it.
  const status = document.getElementById("copy-status");
  const copy = document.getElementById("copy");
  let revert;
  copy.addEventListener("click", () => {
    status.textContent = status.dataset.done;
    copy.classList.remove("pulse");
    void copy.offsetWidth; // restart the animation on a repeated click
    copy.classList.add("pulse");
    clearTimeout(revert);
    revert = setTimeout(() => {
      status.textContent = status.dataset.idle;
    }, 1500);
  });

  // Each character its own element so they can cascade in — the code is the
  // one thing on screen the user has to read carefully.
  function renderCode(code) {
    const target = document.getElementById("code");
    if (target.dataset.value === code) return;
    target.dataset.value = code;
    target.replaceChildren(
      ...[...code].map((character, index) => {
        const span = document.createElement("span");
        span.textContent = character;
        span.style.animationDelay = index * 45 + "ms";
        return span;
      }),
    );
  }

  // Counts down from the grant's own expires_in. A depleting bar carries the
  // "this is running out" faster than digits do.
  let ticking;
  function startCountdown(seconds) {
    clearInterval(ticking);
    const bar = document.getElementById("lifetime");
    const label = document.getElementById("countdown");
    const endsAt = Date.now() + seconds * 1000;

    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      bar.style.width = (left / (seconds * 1000)) * 100 + "%";
      const total = Math.ceil(left / 1000);
      const minutes = Math.floor(total / 60);
      const rest = String(total % 60).padStart(2, "0");
      label.textContent = label.dataset.label.replace("{{TIME}}", minutes + ":" + rest);
      if (left <= 0) clearInterval(ticking);
    };

    tick();
    ticking = setInterval(tick, 1000);
  }

  window.addEventListener("message", (event) => {
    const { step, code, account, error, warning, expiresIn, handover } = event.data;
    if (handover) {
      document.body.classList.add("handover");
      return;
    }
    document.body.classList.remove("handover");
    if (code) renderCode(code);
    if (account) document.getElementById("account").textContent = account;
    if (error) document.getElementById("error").textContent = error;

    const warned = document.getElementById("warning");
    warned.textContent = warning ?? "";
    warned.hidden = !warning;

    if (expiresIn) startCountdown(Number(expiresIn));
    if (step !== "waiting") clearInterval(ticking);

    document.body.dataset.step = step;
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}

/** The Square Cloud mark, inlined so the view needs no local resource roots. */
function logo(): string {
  return `<svg viewBox="0 0 307 307" role="img" aria-label="Square Cloud">
    <g transform="translate(0,307) scale(0.1,-0.1)" fill="currentColor">
      <path d="M588 2723 l-3 -228 -232 -3 -233 -2 0 -1190 0 -1190 1195 0 1195 0 0 230 0 230 235 0 235 0 0 1190 0 1190 -1195 0 -1195 0 -2 -227z m2260 -960 l2 -1053 -170 0 -170 0 0 890 0 890 -892 2 -893 3 -3 150 c-1 82 0 155 2 162 4 11 203 13 1063 11 l1058 -3 3 -1052z m-520 -465 l2 -1008 -1015 0 -1015 0 0 1003 c0 552 3 1007 7 1010 3 4 459 6 1012 5 l1006 -3 3 -1007z"/>
      <path d="M590 1405 l0 -835 838 2 837 3 0 65 0 65 -772 3 -773 2 0 765 0 765 -65 0 -65 0 0 -835z"/>
    </g>
  </svg>`;
}

/**
 * Sizes scale with `vw` because the viewport here IS the sidebar, which the
 * user can drag down to ~150px. Everything that could overflow — the mark, the
 * wordmark, the 8-char code — shrinks with it.
 */
function styles(): string {
  return `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    overflow-x: hidden;
  }
  /* Faint grid + glow so the view reads as a place, not a form. */
  .backdrop {
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0.5;
    background:
      radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent), transparent 55%),
      repeating-linear-gradient(0deg, transparent 0 31px, color-mix(in srgb, var(--vscode-foreground) 6%, transparent) 31px 32px),
      repeating-linear-gradient(90deg, transparent 0 31px, color-mix(in srgb, var(--vscode-foreground) 6%, transparent) 31px 32px);
    mask-image: radial-gradient(circle at 50% 40%, #000 20%, transparent 72%);
    animation: drift 16s ease-in-out infinite alternate;
  }
  @keyframes drift {
    from { opacity: 0.38; transform: scale(1); }
    to { opacity: 0.62; transform: scale(1.06); }
  }
  header svg { animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
  header h1 { animation: rise 0.5s 0.06s cubic-bezier(0.16, 1, 0.3, 1) both; }
  main {
    position: relative;
    width: min(360px, 100% - 24px);
    margin: 0 auto;
    padding: 24px 0;
    text-align: center;
  }
  header {
    display: grid;
    justify-items: center;
    gap: clamp(8px, 2vw, 14px);
    margin-bottom: clamp(16px, 5vw, 28px);
  }
  header svg { width: clamp(32px, 13vw, 52px); height: auto; opacity: 0.9; }
  h1 {
    margin: 0;
    font-size: clamp(15px, 5.5vw, 24px);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  section { display: none; }
  /* Going from display:none to block restarts the animation, so each step
     arrives on its own instead of snapping into place. */
  body[data-step="choose"]   section[data-for="choose"],
  body[data-step="starting"] section[data-for="starting"],
  body[data-step="waiting"]  section[data-for="waiting"],
  body[data-step="done"]     section[data-for="done"],
  body[data-step="error"]    section[data-for="error"] {
    display: block;
    animation: rise 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }

  .lede { margin: 0 0 16px; line-height: 1.5; overflow-wrap: anywhere; }
  .fine {
    margin: 14px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--vscode-descriptionForeground);
  }
  .actions { display: grid; gap: 8px; }
  .fine + .actions { margin-top: 18px; }
  button {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 9px 16px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground);
    transition: background 0.15s ease, transform 0.1s ease, color 0.15s ease;
  }
  button:active { transform: scale(0.98); }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.primary {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  button.link {
    margin-top: 14px;
    padding: 4px;
    width: 100%;
    border-radius: 6px;
    background: none;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  button.link:hover { background: none; color: var(--vscode-foreground); }

  button.code {
    display: block;
    width: 100%;
    padding: clamp(10px, 3vw, 16px) 8px;
    border: 1px dashed color-mix(in srgb, var(--vscode-foreground) 28%, transparent);
    border-radius: 10px;
    background: none;
    color: inherit;
    font-family: var(--vscode-editor-font-family), monospace;
    font-size: clamp(15px, 8vw, 30px);
    font-weight: 600;
    letter-spacing: clamp(0.05em, 1.2vw, 0.24em);
    text-indent: clamp(0.05em, 1.2vw, 0.24em);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  button.code:hover {
    background: color-mix(in srgb, var(--vscode-foreground) 7%, transparent);
    border-style: solid;
  }
  button.code span {
    display: inline-block;
    animation: drop 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes drop {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
  }
  button.code.pulse {
    animation: pulse 0.45s ease-out;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-textLink-foreground) 45%, transparent); }
    100% { box-shadow: 0 0 0 12px transparent; }
  }
  #copy-status { margin-top: 8px; }

  .warning {
    margin: 14px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.45;
    text-align: left;
    color: var(--vscode-foreground);
    background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 18%, transparent);
    animation: rise 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* Runs down with the grant. A bar reads "this is expiring" faster than digits. */
  .lifetime {
    height: 2px;
    margin: 14px 0 6px;
    border-radius: 2px;
    overflow: hidden;
    background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
  }
  .lifetime-fill {
    height: 100%;
    width: 100%;
    border-radius: inherit;
    background: var(--vscode-textLink-foreground);
    transition: width 1s linear;
  }
  .countdown { margin-top: 0; font-variant-numeric: tabular-nums; }
  .status {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin: 18px 0 0;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }
  .spinner {
    width: 20px;
    height: 20px;
    margin: 0 auto;
    border: 2px solid color-mix(in srgb, var(--vscode-foreground) 25%, transparent);
    border-top-color: var(--vscode-foreground);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .spinner.small { width: 11px; height: 11px; margin: 0; border-width: 1.5px; flex: none; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Motion is decoration here — every state is readable without it. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
    .spinner { animation-duration: 3s !important; animation-iteration-count: infinite !important; }
    .lifetime-fill { transition-duration: 0.001ms !important; }
  }

  .badge {
    width: 38px;
    height: 38px;
    margin: 0 auto 16px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 19px;
    background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
  }
  .cross { color: var(--vscode-errorForeground); }

  /* The success mark draws itself, then the whole view hands over to the
     dashboard on its own — nobody should have to click to leave a success. */
  .tick { width: 46px; height: 46px; margin: 0 auto 16px; display: block; }
  .tick-ring, .tick-mark {
    fill: none;
    stroke: var(--vscode-testing-iconPassed, #3fb950);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tick-ring {
    stroke-dasharray: 126;
    stroke-dashoffset: 126;
    opacity: 0.45;
    animation: draw 0.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
  .tick-mark {
    stroke-dasharray: 26;
    stroke-dashoffset: 26;
    animation: draw 0.3s 0.42s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
  @keyframes draw { to { stroke-dashoffset: 0; } }

  /* Plays just before the host swaps the sidebar over. */
  body.handover main { animation: handover 0.36s ease-in forwards; }
  @keyframes handover {
    to { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
  `;
}

function escapeHtml(value: string): string {
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
