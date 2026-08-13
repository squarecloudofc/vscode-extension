/**
 * End-to-end self-check for the authorize flow. Runs the real module against a
 * fake API (stubbed `fetch`) and a real browser hit on the loopback redirect.
 *
 *   node scripts/check-authorize.mjs
 *
 * Fails if PKCE stops being S256, the redirect_uri stops matching between
 * start and claim, or the loopback listener starts answering paths other than
 * /callback.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "sq-authorize-"));
const stub = (name, source) => {
  const file = join(dir, name);
  writeFileSync(file, source);
  return file;
};

const bundle = join(dir, "authorize.mjs");
await esbuild.build({
  entryPoints: ["src/lib/api-key/authorize.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  alias: {
    vscode: stub(
      "vscode.mjs",
      "export class CancellationError extends Error {}",
    ),
    "vscode-ext-localisation": stub(
      "i18n.mjs",
      "export const t = (key) => key;",
    ),
    "@squarecloud/api": stub(
      "sdk.mjs",
      `export class SquareCloudAPIError extends Error {
         constructor(code, message) { super(code); this.code = code; this.detail = message; }
       }`,
    ),
  },
});

const { beginAuthorization } = await import(pathToFileURL(bundle).href);

let started;
let claimed;
let claims = 0;
/** Codes the fake API answers with, in order, before granting the key. */
let claimScript = [];
let startExtras = {};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const GRANT = {
  id: "key-id",
  api_key: "user-secret",
  account: { id: "account-id", email: "maria@empresa.com" },
  scopes: ["apps:read"],
  expires_at: "2026-11-09T12:00:00.000Z",
};

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (String(url).endsWith("/start")) {
    started = body;
    return json({
      status: "success",
      response: {
        code: "grant-code",
        display: "A7F3C21B",
        expires_in: 600,
        ...startExtras,
      },
    });
  }
  if (String(url).endsWith("/claim")) {
    claimed = body;
    const scripted = claimScript[claims++];
    if (scripted) {
      return json(
        { status: "error", code: scripted },
        scripted === "RATE_LIMIT" ? 429 : 400,
      );
    }
    return json({ status: "success", response: GRANT });
  }
  throw new Error(`unexpected request: ${url}`);
};

const pending = await beginAuthorization("pt-br");

assert.equal(started.client_id, "vscode");
assert.equal(started.challenge_method, "S256", "challenge_method must be S256");
assert.ok(started.scopes.includes("account:read"));
assert.ok(
  started.redirect_uri.startsWith("http://127.0.0.1:"),
  "redirect must be loopback, not a vscode:// scheme",
);
assert.equal(pending.display, "A7F3C21B");
assert.ok(
  !pending.url.includes("A7F3C21B"),
  "the display code must never travel in the URL",
);

const settled = pending.wait().then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error }),
);

// A request to any other path must NOT complete the flow.
await fetchLoopback(started.redirect_uri.replace("/callback", "/whatever"));
assert.equal(
  await Promise.race([settled, timeout(150)]),
  "pending",
  "only /callback may complete the authorization",
);

await fetchLoopback(started.redirect_uri);
const result = await settled;
assert.ok(result.ok, `wait() rejected: ${result.error}`);

assert.equal(
  claimed.challenge ?? undefined,
  undefined,
  "claim sends the verifier, never the challenge",
);
assert.ok(claimed.verifier.length >= 43, "verifier must be at least 43 chars");
assert.equal(
  createHash("sha256").update(claimed.verifier).digest("base64url"),
  started.challenge,
  "challenge must be the S256 of the verifier sent at claim",
);
assert.equal(
  claimed.redirect_uri,
  started.redirect_uri,
  "redirect_uri must be identical at start and claim",
);
assert.equal(result.value.apiKey, "user-secret");
assert.equal(result.value.account.email, "maria@empresa.com");
assert.equal(result.value.expiresAt, "2026-11-09T12:00:00.000Z");
assert.equal(claims, 1, "the redirect should claim once, not poll a burst");

console.log("browser flow: ok");

// ---------------------------------------------------------------------------
// Polling: the loopback redirect never arrives (Remote SSH, or a browser that
// won't reach 127.0.0.1). The poll alone has to carry the flow through, and
// AUTHORIZATION_PENDING must not be treated as a failure.
// ---------------------------------------------------------------------------

claims = 0;
claimScript = ["AUTHORIZATION_PENDING", "AUTHORIZATION_PENDING"];
startExtras = { interval: 0.05 }; // 50ms so the check stays fast

const polled = await beginAuthorization("pt-br");
const grant = await polled.wait();

assert.equal(claims, 3, "should keep polling through AUTHORIZATION_PENDING");
assert.equal(grant.apiKey, "user-secret");
assert.equal(
  started.redirect_uri,
  claimed.redirect_uri,
  "polled claims must carry the same redirect_uri as start",
);

console.log("polling through PENDING: ok");

// A client bug — the fifth of these destroys the grant, so it must never loop.
claims = 0;
claimScript = ["INVALID_VERIFIER"];
startExtras = { interval: 0.05 };

const doomed = await beginAuthorization("pt-br");
const rejection = await doomed.wait().then(
  () => null,
  (error) => error,
);

assert.ok(rejection, "INVALID_VERIFIER must reject, not retry");
assert.equal(rejection.code, "INVALID_VERIFIER");
assert.equal(claims, 1, "INVALID_VERIFIER must not be retried blind");

console.log("no blind retry on INVALID_VERIFIER: ok");

async function fetchLoopback(url) {
  // `fetch` is stubbed above — talk to the loopback server with raw http.
  const { get } = await import("node:http");
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      res.resume();
      res.on("end", resolve);
    }).on("error", reject);
  });
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve("pending"), ms));
}
