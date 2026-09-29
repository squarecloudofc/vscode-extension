import {
  CancellationError,
  CancellationTokenSource,
  commands,
  env,
  ProgressLocation,
  Uri,
  type WebviewView,
  type WebviewViewProvider,
  window,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { ApiKeyAccount } from "@/lib/api-key";
import type { SquareCloudExtension } from "@/managers/extension";
import {
  beginAuthorization,
  type PendingAuthorization,
} from "@/lib/api-key/authorize";
import { confirm } from "@/lib/utils/dialogs";
import {
  describeCode,
  describeError,
  isApiError,
  problemOf,
} from "@/lib/utils/errors";
import { getLocale } from "@/lib/utils/locale";
import { Logger } from "@/structures/logger";

import { renderAuthView } from "./html";

type Step = "starting" | "choose" | "waiting" | "done" | "error";

/** Long enough for the success mark to finish drawing and be read. */
const DONE_LINGER_MS = 1_500;
/** Matches the `handover` animation in the webview. */
const HANDOVER_MS = 340;

/**
 * Context key deciding which half of the sidebar shows: this view, or the four
 * tree views. Never both.
 *
 * Phrased as "hide" on purpose. Before the extension activates the key does
 * not exist, and an unset key reads as false — so the default is this view (on
 * its spinner step), not a flash of four empty trees.
 */
const HIDE_AUTH = "squarecloud.hideAuth";

export class AuthViewProvider implements WebviewViewProvider {
  public static readonly viewId = "auth-view";

  private readonly logger = new Logger("Auth");
  private view?: WebviewView;
  private cancellation?: CancellationTokenSource;
  private pending?: PendingAuthorization;
  private doneTimer?: ReturnType<typeof setTimeout>;

  /** Last step pushed, replayed when the webview is rebuilt after being hidden. */
  private step: Step = "starting";
  private data: Record<string, string> = {};

  /** Set when the user asks to connect while a key is already stored. */
  private reconnecting = false;

  constructor(private readonly extension: SquareCloudExtension) {}

  resolveWebviewView(view: WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = renderAuthView(getLocale());
    view.webview.onDidReceiveMessage((message) =>
      this.onMessage(message?.type),
    );
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
      // Someone who opened this to switch accounts and then walked away must
      // not be left with the sidebar stuck on sign-in.
      if (this.reconnecting) void this.finish();
    });
  }

  /** Reveals the view, forcing it open even when a key is already stored. */
  async reveal(): Promise<void> {
    // Only someone with a key is re-connecting, and has a dashboard to go
    // back to; for anyone else this is just the sign-in.
    this.reconnecting = Boolean(await this.extension.config.apiKey.get());
    await this.syncVisibility();
    await commands.executeCommand(`${AuthViewProvider.viewId}.focus`);
    if (this.step === "starting" || this.step === "done") this.show("choose");
    else this.push();
  }

  /**
   * Points the sidebar at this view or at the tree views. Called on startup and
   * whenever the stored key appears or disappears.
   */
  async syncVisibility(): Promise<void> {
    const connected = Boolean(await this.extension.config.apiKey.get());
    await commands.executeCommand(
      "setContext",
      HIDE_AUTH,
      connected && !this.reconnecting,
    );
    if (!connected && this.step === "starting") this.show("choose");
  }

  private onMessage(type: string | undefined): void {
    switch (type) {
      case "ready":
        // The webview was (re)built — put it back on the step we were on.
        this.push();
        return;
      case "connect":
        return void this.connect();
      case "paste":
        return void this.paste();
      case "open":
        return void this.openApprovalPage();
      case "copy":
        return void this.copyCode();
      case "security":
        return void env.openExternal(Uri.parse(securityPage()));
      case "tour":
        return void commands.executeCommand("squarecloud.getStarted");
      case "retry":
        this.show("choose");
        return;
      case "cancel":
        this.abort();
        // Cancelling a re-connect means "never mind", not "start over" — hand
        // the sidebar back instead of parking on the sign-in screen.
        if (this.reconnecting) return void this.finish();
        this.show("choose", { notice: t("auth.cancelled"), kind: "cancelled" });
        return;
      case "close":
        return void this.finish();
    }
  }

  private show(step: Step, data: Record<string, string> = {}): void {
    this.step = step;
    this.data = data;
    this.push();
  }

  private push(): void {
    this.view?.webview.postMessage({
      step: this.step,
      ...this.data,
      // Offers the way back to the dashboard, which otherwise only a
      // successful connect or a reload would give.
      reconnecting: this.reconnecting,
    });
  }

  /**
   * Something the poll can recover from — the account hitting its key limit, a
   * 429. Says so without leaving the waiting step, because the grant is still
   * alive and the next tick may well succeed.
   */
  private warn(code: string): void {
    const kind = problemOf(code);
    this.data = {
      ...this.data,
      warning: describeCode(code),
      warningKind: kind,
      warningTitle:
        kind === "keyLimit"
          ? t("auth.warning.keyLimit")
          : t("auth.warning.rateLimit"),
    };
    this.push();
  }

  /** The error step, pictured by what kind of problem it is. */
  private fail(error: unknown): void {
    this.show("error", {
      error: describeError(error),
      kind: problemOf(error),
      code: isApiError(error) ? error.code : "",
    });
  }

  private async connect(): Promise<void> {
    this.abort();
    // Held locally and made before the first await: a Cancel or a second
    // Connect while `start` is in flight, or while the code is copied and the
    // browser opens, must stop this attempt rather than race it.
    const cancellation = new CancellationTokenSource();
    this.cancellation = cancellation;
    let pending: PendingAuthorization | undefined;
    this.show("starting");

    try {
      pending = await beginAuthorization(getLocale());
      if (cancellation.token.isCancellationRequested) return pending.dispose();
      this.pending = pending;

      // The countdown runs off the server's `expires_in`, never a hardcoded 10
      // minutes — the grant's clock is the only one that matters.
      this.show("waiting", {
        code: pending.display,
        expiresIn: String(pending.expiresIn),
        // Absolute, so a webview rebuilt mid-wait resumes the same countdown.
        expiresAt: String(Date.now() + pending.expiresIn * 1000),
      });
      // On the clipboard before the browser opens, so the page can be filled
      // with a paste instead of squinting back at the sidebar.
      await this.copyCode();
      await this.openApprovalPage();

      const grant = await pending.wait(cancellation.token, {
        onWarning: (code) => this.warn(code),
      });
      if (!(await this.storeGrant(grant))) {
        this.show("choose");
        return;
      }

      const message = t("setApiKey.connect.success", {
        EMAIL: grant.account.email,
      });
      this.show("done", { account: message });
      window.showInformationMessage(message);
      this.lingerThenFinish();
    } catch (error) {
      if (
        error instanceof CancellationError ||
        cancellation.token.isCancellationRequested
      ) {
        return;
      }
      this.logger.error("authorization failed", error);
      // Running out the clock is the common "failure" — say so plainly.
      if (isApiError(error) && error.code === "INVALID_GRANT") {
        this.show("error", { error: t("auth.expired.body"), kind: "expired" });
      } else {
        this.fail(error);
      }
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }

  private async openApprovalPage(): Promise<void> {
    if (!this.pending) return;
    await env.openExternal(Uri.parse(this.pending.url));
  }

  private async copyCode(): Promise<void> {
    if (!this.pending) return;
    await env.clipboard.writeText(this.pending.display);
  }

  /**
   * Whoever approves decides which account the key comes from, and PKCE can't
   * tell "my account" from "a stranger's" — only the person reading the email
   * can. So never swap accounts silently.
   */
  private async storeGrant(grant: {
    apiKey: string;
    account: { id: string; email: string };
    scopes: string[];
    expiresAt?: string;
  }): Promise<boolean> {
    const current = await this.extension.config.apiKey.getAccount();

    if (current && current.id !== grant.account.id) {
      const accepted = await confirm(
        t("setApiKey.connect.accountChanged", {
          OLD: current.email,
          NEW: grant.account.email,
        }),
        { destructive: true },
      );
      if (!accepted) return false;
    }

    await this.apply(grant.apiKey, {
      id: grant.account.id,
      email: grant.account.email,
      scopes: grant.scopes,
      expiresAt: grant.expiresAt,
    });
    return true;
  }

  /** Fallback for keys created by hand in the dashboard (CI, or no browser). */
  private async paste(): Promise<void> {
    const apiKeyUrl = securityPage();

    const apiKey = await window.showInputBox({
      title: t("setApiKey.apiKey"),
      placeHolder: t("generic.paste"),
      ignoreFocusOut: true,
      password: true,
      prompt: `[${t("setApiKey.tutorial.button")}](${apiKeyUrl})`,
    });

    if (!apiKey) return;

    try {
      const valid = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: t("setApiKey.testing"),
        },
        () => this.extension.config.apiKey.test(apiKey),
      );

      if (!valid) {
        this.show("error", { error: t("setApiKey.invalid"), kind: "session" });
        return;
      }
    } catch (error) {
      this.fail(error);
      return;
    }

    // A hand-made key carries no account info — drop any from a previous connect.
    await this.apply(apiKey, undefined);
    this.show("done", { account: t("setApiKey.success") });
    this.lingerThenFinish();
  }

  private async apply(
    apiKey: string,
    account: ApiKeyAccount | undefined,
  ): Promise<void> {
    await this.extension.config.apiKey.set(apiKey, account);
    this.extension.api.invalidateClient();
    await this.extension.api.refresh();
  }

  /** Hands the sidebar over to the dashboard. */
  private async finish(): Promise<void> {
    this.clearDoneTimer();
    this.reconnecting = false;
    this.step = "starting";
    await this.syncVisibility();
  }

  /**
   * Success is not a decision, so it doesn't get a button: the mark draws, the
   * view fades out, and the dashboard takes the slot on its own.
   */
  private lingerThenFinish(): void {
    this.clearDoneTimer();
    this.doneTimer = setTimeout(() => {
      this.view?.webview.postMessage({ handover: true });
      this.doneTimer = setTimeout(() => void this.finish(), HANDOVER_MS);
    }, DONE_LINGER_MS);
  }

  private clearDoneTimer(): void {
    if (this.doneTimer) clearTimeout(this.doneTimer);
    this.doneTimer = undefined;
  }

  private abort(): void {
    this.cancellation?.cancel();
    this.cancellation?.dispose();
    this.cancellation = undefined;
    this.pending?.dispose();
    this.pending = undefined;
  }

  dispose(): void {
    this.clearDoneTimer();
    this.abort();
  }
}

function securityPage(): string {
  return `https://squarecloud.app/${getLocale()}/account/security`;
}
