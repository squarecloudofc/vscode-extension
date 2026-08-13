import type { AddressInfo } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { SquareCloudAPIError } from "@squarecloud/api";
import { CancellationError, type CancellationToken } from "vscode";
import { t } from "vscode-ext-localisation";

const AUTHORIZE_BASE = "https://api.squarecloud.app/v2/account/authorize";
const DASHBOARD_BASE = "https://squarecloud.app";
const CLIENT_ID = "vscode";

/**
 * Port used in the loopback redirect. A TCP port can't be hijacked the way the
 * `vscode://` scheme can (last registrant wins on Windows), so loopback is the
 * path we take. Falls back to an ephemeral port if this one is taken.
 */
const PREFERRED_PORT = 53127;

/** Used only if `start` omits `interval` — the server's value always wins. */
const FALLBACK_INTERVAL_S = 10;
/**
 * ±15% so several clients behind the same IP don't sync up. Residential CGNAT
 * puts unrelated people on one IPv4, and the poll budget is per IP.
 */
const POLL_JITTER = 0.15;
/** A 429 blocks for 300s while the grant lives 600s — only a real backoff recovers. */
const RATE_LIMIT_BACKOFF_MS = 60_000;

/**
 * Scopes this extension actually calls — nothing more. `files:*` and `blob:*`
 * are deliberately absent (no file manager / storage commands exist here).
 *
 * `workspaces:manage` is the strong one: it reaches other accounts and its
 * grant outlives the key. It's here only because the Workspaces tree view and
 * its commands can't work without it.
 */
export const EXTENSION_SCOPES = [
  "account:read",
  "apps:read",
  "apps:control",
  "apps:write",
  "apps:deploy",
  "envs:read",
  "envs:write",
  "snapshots:read",
  "snapshots:write",
  "databases:read",
  "databases:write",
  "databases:credentials",
  "workspaces:manage",
];

export interface AuthorizedAccount {
  apiKey: string;
  account: { id: string; email: string };
  scopes: string[];
  expiresAt?: string;
}

export interface AuthorizationEvents {
  /** Fired once per distinct code the poll can recover from (e.g. key limit). */
  onWarning?(code: string): void;
}

export interface PendingAuthorization {
  /**
   * Code the user must enter on the approval page. It never travels in the URL —
   * that's what stops whoever sees the `code` from approving with their own
   * account and handing this editor a key that publishes source into it.
   */
  display: string;
  /** Approval page to open in the browser. */
  url: string;
  /** Seconds the grant is good for. Drive any countdown from this, not from 600. */
  expiresIn: number;
  /** Resolves when a claim succeeds; rejects on expiry, cancel, or a real error. */
  wait(
    token?: CancellationToken,
    events?: AuthorizationEvents,
  ): Promise<AuthorizedAccount>;
  dispose(): void;
}

/**
 * Starts the "Connect application" flow: PKCE pair, loopback listener, then
 * `POST /authorize/start`. The returned object carries what the UI must show
 * and the promise that completes the exchange.
 */
export async function beginAuthorization(
  locale: string,
): Promise<PendingAuthorization> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const { server, port, redirected } = await listenForRedirect();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  let start: {
    code: string;
    display: string;
    expires_in?: number;
    interval?: number;
  };

  try {
    start = await post("start", {
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scopes: EXTENSION_SCOPES,
      challenge,
      challenge_method: "S256",
    });
  } catch (error) {
    server.close();
    throw error;
  }

  const expiresIn = Number(start.expires_in) || 600;
  const intervalMs = (Number(start.interval) || FALLBACK_INTERVAL_S) * 1000;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    server.close();
  };

  return {
    display: start.display,
    expiresIn,
    url: `${DASHBOARD_BASE}/${locale}/account/security/authorize?code=${encodeURIComponent(start.code)}`,

    /**
     * Polls `claim` until it yields the key. The loopback redirect is an
     * accelerator, not the mechanism: whichever arrives first — the browser
     * coming back or the next tick — moves the loop along.
     *
     * Polling is the mechanism because loopback alone breaks the moment the
     * browser and the extension host are on different machines (Remote SSH,
     * Codespaces), where `127.0.0.1` is not the same computer. It costs
     * nothing: `AUTHORIZATION_PENDING` consumes neither the grant nor one of
     * the five verifier attempts.
     */
    async wait(token, events) {
      const deadline = Date.now() + expiresIn * 1000;
      const warned = new Set<string>();
      let awaitingRedirect = true;

      try {
        while (Date.now() < deadline) {
          const races: Promise<unknown>[] = [sleep(jitter(intervalMs), token)];
          if (awaitingRedirect) {
            races.push(
              redirected.then(() => {
                awaitingRedirect = false;
              }),
            );
          }
          await Promise.race(races);

          try {
            // The key is born here, in the claim, never in `start` — a request
            // nobody redeems leaves no orphan key on the account.
            const claim = await post("claim", {
              code: start.code,
              verifier,
              // Re-checked server-side against the value sent to `start`.
              redirect_uri: redirectUri,
            });
            return {
              apiKey: claim.api_key,
              account: claim.account,
              scopes: claim.scopes ?? EXTENSION_SCOPES,
              expiresAt: claim.expires_at,
            };
          } catch (error) {
            const code =
              error instanceof SquareCloudAPIError ? error.code : undefined;

            switch (code) {
              case "AUTHORIZATION_PENDING":
                // The normal state, not an error. Nothing was consumed.
                continue;

              case "NETWORK_ERROR":
                // Never abort here: if the server did create the key and the
                // response was lost, another claim within 60s returns the SAME
                // key with a fresh secret instead of burning one of the
                // account's five key slots.
                continue;

              case "APIKEY_LIMIT_REACHED":
                // The grant stays approved for 60s, so the user can revoke a
                // key in the dashboard and the next tick picks it up.
                if (!warned.has(code)) {
                  warned.add(code);
                  events?.onWarning?.(code);
                }
                continue;

              case "RATE_LIMIT":
              case "KEEP_CALM":
                if (!warned.has("RATE_LIMIT")) {
                  warned.add("RATE_LIMIT");
                  events?.onWarning?.("RATE_LIMIT");
                }
                await sleep(RATE_LIMIT_BACKOFF_MS, token);
                continue;

              // INVALID_VERIFIER / INVALID_REDIRECT_URI / INVALID_REQUEST are
              // client bugs, and each one spends one of five attempts — the
              // fifth destroys the grant. Retrying blind burns the user's flow.
              default:
                throw error;
            }
          }
        }

        throw new SquareCloudAPIError("INVALID_GRANT");
      } finally {
        close();
      }
    },

    dispose: close,
  };
}

/** Sleep that gives up the moment the user cancels. */
function sleep(ms: number, token?: CancellationToken): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token?.isCancellationRequested) return reject(new CancellationError());
    const timer = setTimeout(() => {
      cancellation?.dispose();
      resolve();
    }, ms);
    const cancellation = token?.onCancellationRequested(() => {
      clearTimeout(timer);
      reject(new CancellationError());
    });
  });
}

function jitter(ms: number): number {
  return Math.round(ms * (1 + (Math.random() * 2 - 1) * POLL_JITTER));
}

/**
 * Every authorize route speaks JSON and answers with the usual
 * `{ status, response }` envelope. Errors are re-thrown as
 * `SquareCloudAPIError` so `describeError` localises them like any other.
 */
async function post(path: string, body: unknown) {
  const response = await fetch(`${AUTHORIZE_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error) => {
    throw new SquareCloudAPIError("NETWORK_ERROR", error?.message);
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.status === "error") {
    // A 429 without a parseable body still has to read as a rate limit — the
    // poll loop backs off on that code and would otherwise abort the flow.
    const fallback =
      response.status === 429
        ? "RATE_LIMIT"
        : `UNKNOWN_ERROR_${response.status}`;
    throw new SquareCloudAPIError(data?.code ?? fallback);
  }

  return data.response ?? data;
}

/** Binds 127.0.0.1 and resolves `redirected` on the first hit to /callback. */
function listenForRedirect(): Promise<{
  server: Server;
  port: number;
  redirected: Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    let onRedirect: () => void;
    const redirected = new Promise<void>((res) => {
      onRedirect = res;
    });

    const server = createServer((req, res) => {
      if ((req.url ?? "").split("?")[0] !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(callbackPage());
      onRedirect();
    });

    let retried = false;
    server.on("error", (error: NodeJS.ErrnoException) => {
      // Another window is mid-flow on the preferred port; any loopback port
      // is accepted, so take whatever the OS hands us.
      if (error.code === "EADDRINUSE" && !retried) {
        retried = true;
        server.listen(0, "127.0.0.1");
        return;
      }
      reject(error);
    });

    server.on("listening", () => {
      resolve({
        server,
        port: (server.address() as AddressInfo).port,
        redirected,
      });
    });

    server.listen(PREFERRED_PORT, "127.0.0.1");
  });
}

function callbackPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Square Cloud</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0d0d0d;color:#fafafa;text-align:center}p{color:#a1a1a1}</style>
</head><body><div><h1>${t("setApiKey.connect.browserTitle")}</h1>
<p>${t("setApiKey.connect.browserBody")}</p></div></body></html>`;
}
