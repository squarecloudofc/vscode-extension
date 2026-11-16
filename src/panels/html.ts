import { randomBytes } from "node:crypto";
import {
  env,
  extensions,
  Uri,
  type Webview,
  type WebviewOptions,
} from "vscode";

import type { Boot, ViewName } from "@/webview/protocol";

/** `publisher.name` from package.json. */
const EXTENSION_ID = "squarecloud.squarecloud";

function extensionUri(): Uri {
  const extension = extensions.getExtension(EXTENSION_ID);
  if (!extension) throw new Error(`Extension ${EXTENSION_ID} not found`);
  return extension.extensionUri;
}

/** The built bundle and its fonts. */
const distUri = () => Uri.joinPath(extensionUri(), "dist");
/** The runtime and database logos (src/webview/lib/logos.ts). */
const brandUri = () => Uri.joinPath(extensionUri(), "resources", "brand");

/** Options for any webview that renders `renderShell`: it loads only these. */
export function shellOptions(): WebviewOptions {
  return { enableScripts: true, localResourceRoots: [distUri(), brandUri()] };
}

/**
 * The page every webview loads: `dist/webview.css` and `dist/webview.js`
 * under a strict CSP (scripts by nonce only, styles, fonts and images from
 * the extension), and the view's name, strings, initial state and the logos'
 * URL as JSON for
 * `src/webview/main.tsx`.
 */
export function renderShell(
  webview: Webview,
  view: ViewName,
  l10n: Record<string, string>,
  initial: unknown,
): string {
  const nonce = randomBytes(16).toString("base64");
  const dist = distUri();
  const asset = (file: string) =>
    webview.asWebviewUri(Uri.joinPath(dist, file)).toString();
  const boot: Boot = {
    view,
    l10n,
    initial,
    brand: webview.asWebviewUri(brandUri()).toString(),
  };
  // Inside <script>, "</script>" in a string would end the element early.
  const json = JSON.stringify(boot).replace(/</g, "\\u003c");
  const lang = /^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(env.language)
    ? env.language
    : "en";
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} https: data:`,
  ].join("; ");
  const surface = view === "sidebar" ? "surface-sidebar" : "surface-editor";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${asset("webview.css")}">
</head>
<body class="${surface}">
<div id="root"></div>
<script type="application/json" id="sq-boot">${json}</script>
<script nonce="${nonce}" src="${asset("webview.js")}"></script>
</body>
</html>`;
}
