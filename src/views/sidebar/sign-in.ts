import {
  CancellationError,
  CancellationTokenSource,
  env,
  ProgressLocation,
  Uri,
  window,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { ApiKeyAccount } from "@/lib/api-key";
import type { SquareCloudExtension } from "@/managers/extension";
import type { SignInState } from "@/webview/protocol";
import {
  type AuthorizedAccount,
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

/**
 * The sign-in half of the sidebar: the browser flow with the 8-character
 * code (src/lib/api-key/authorize.ts), or a pasted key. It holds the screen's
 * state and calls `onChange` whenever it moves; `onDone` hands the sidebar
 * back to the account once a key is stored, or once a re-connect is dropped.
 */
export class SignIn {
  private readonly logger = new Logger("SignIn");
  private cancellation?: CancellationTokenSource;
  private pending?: PendingAuthorization;

  state: SignInState = { step: "choose", reconnecting: false };

  constructor(
    private readonly extension: SquareCloudExtension,
    private readonly onChange: () => void,
    private readonly onDone: () => void,
  ) {}

  /** Back to the first step; `reconnecting` when a key is already stored. */
  reset(reconnecting: boolean): void {
    if (this.state.step === "waiting" || this.state.step === "starting") {
      this.set({ reconnecting });
      return;
    }
    this.state = { step: "choose", reconnecting };
    this.onChange();
  }

  private set(patch: Partial<SignInState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange();
  }

  async connect(): Promise<void> {
    this.abort();
    // Held locally and made before the first await: a Cancel or a second
    // Connect while `start` is in flight, or while the code is copied and the
    // browser opens, must stop this attempt rather than race it.
    const cancellation = new CancellationTokenSource();
    this.cancellation = cancellation;
    let pending: PendingAuthorization | undefined;
    const { reconnecting } = this.state;
    this.state = { step: "starting", reconnecting };
    this.onChange();

    try {
      pending = await beginAuthorization(getLocale());
      if (cancellation.token.isCancellationRequested) return pending.dispose();
      this.pending = pending;

      // The server's `expires_in`, never a hardcoded 10 minutes: the grant's
      // clock is the only one that matters.
      this.set({
        step: "waiting",
        code: pending.display,
        expiresAt: Date.now() + pending.expiresIn * 1000,
      });
      // On the clipboard before the browser opens, so the page can be filled
      // with a paste instead of squinting back at the sidebar.
      await this.copy();
      await this.open();

      const grant = await pending.wait(cancellation.token, {
        onWarning: (code) => this.warn(code),
      });
      if (!(await this.storeGrant(grant))) {
        this.state = { step: "choose", reconnecting };
        this.onChange();
        return;
      }
      window.showInformationMessage(
        t("setApiKey.connect.success", { EMAIL: grant.account.email }),
      );
      this.onDone();
    } catch (error) {
      if (
        error instanceof CancellationError ||
        cancellation.token.isCancellationRequested
      ) {
        return;
      }
      this.logger.error("authorization failed", error);
      this.fail(error);
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }

  /** Cancelling a re-connect means "never mind", not "start over". */
  cancel(): void {
    this.abort();
    if (this.state.reconnecting) {
      this.onDone();
      return;
    }
    this.state = {
      step: "choose",
      reconnecting: false,
      notice: t("auth.cancelled"),
    };
    this.onChange();
  }

  async copy(): Promise<void> {
    if (this.pending) await env.clipboard.writeText(this.pending.display);
  }

  async open(): Promise<void> {
    if (this.pending) await env.openExternal(Uri.parse(this.pending.url));
  }

  security(): void {
    void env.openExternal(Uri.parse(securityPage()));
  }

  /** Fallback for keys created by hand in the dashboard (CI, or no browser). */
  async paste(): Promise<void> {
    const apiKey = await window.showInputBox({
      title: t("setApiKey.apiKey"),
      placeHolder: t("generic.paste"),
      ignoreFocusOut: true,
      password: true,
      prompt: `[${t("setApiKey.tutorial.button")}](${securityPage()})`,
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
        this.set({
          step: "error",
          error: {
            title: t("problem.session.title"),
            body: t("setApiKey.invalid"),
          },
        });
        return;
      }
    } catch (error) {
      this.fail(error);
      return;
    }

    // A hand-made key carries no account info: drop any from a previous one.
    // The sidebar showing the account is the confirmation.
    await this.apply(apiKey, undefined);
    this.onDone();
  }

  /**
   * Something the poll recovers from (the account's key limit, a 429). Says
   * so without leaving the waiting step: the grant is still alive and the
   * next tick may well succeed.
   */
  private warn(code: string): void {
    const keyLimit = problemOf(code) === "keyLimit";
    this.set({
      warning: {
        title: keyLimit
          ? t("auth.warning.keyLimit")
          : t("auth.warning.rateLimit"),
        body: describeCode(code),
        keyLimit,
      },
    });
  }

  private fail(error: unknown): void {
    // Running out the clock is the common "failure": say so plainly.
    const expired = isApiError(error) && error.code === "INVALID_GRANT";
    const titles = {
      offline: t("problem.offline.title"),
      rateLimit: t("problem.rateLimit.title"),
      outage: t("problem.outage.title"),
      session: t("problem.session.title"),
    } as Record<string, string>;
    this.set({
      step: "error",
      warning: undefined,
      error: expired
        ? { title: t("auth.expired.title"), body: t("auth.expired.body") }
        : {
            title: titles[problemOf(error)] ?? t("problem.error.title"),
            body: describeError(error),
          },
    });
  }

  /**
   * Whoever approves decides which account the key comes from, and PKCE
   * can't tell "my account" from "a stranger's": only the person reading the
   * email can. So never swap accounts silently.
   */
  private async storeGrant(grant: AuthorizedAccount): Promise<boolean> {
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

  private async apply(
    apiKey: string,
    account: ApiKeyAccount | undefined,
  ): Promise<void> {
    await this.extension.config.apiKey.set(apiKey, account);
    this.extension.api.invalidateClient();
    await this.extension.api.refresh();
  }

  private abort(): void {
    this.cancellation?.cancel();
    this.cancellation?.dispose();
    this.cancellation = undefined;
    this.pending?.dispose();
    this.pending = undefined;
  }

  dispose(): void {
    this.abort();
  }
}

function securityPage(): string {
  return `https://squarecloud.app/${getLocale()}/account/security`;
}
