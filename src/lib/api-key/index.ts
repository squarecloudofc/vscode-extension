import type { SecretStorage } from "vscode";
import { SquareCloudAPI } from "@squarecloud/api";
import { commands } from "vscode";
import { t } from "vscode-ext-localisation";

import { ExtensionID } from "@/lib/constants";
import { showMessageWithActions } from "@/lib/utils/dialogs";
import { isApiError } from "@/lib/utils/errors";

import { type ApiKeyAccount, ApiKeyStore } from "./store";

export type { ApiKeyAccount };

/** Codes that mean the key itself is no good — anything else is transient. */
const AUTH_FAILURE_CODES = new Set([
  "ACCESS_DENIED",
  "INVALID_ACCESS_TOKEN",
  "INVALID_API_TOKEN",
  "UNAUTHORIZED",
]);

function isAuthFailure(error: unknown): boolean {
  return isApiError(error) && AUTH_FAILURE_CODES.has(error.code);
}

export class ApiKey {
  private readonly store: ApiKeyStore;
  private expiredNotified = false;

  constructor(secrets: SecretStorage) {
    this.store = new ApiKeyStore(secrets);
  }

  async get() {
    return this.store.get();
  }

  /** Another window connected, switched or disconnected the account. */
  onDidChangeElsewhere(listener: () => void) {
    return this.store.onDidChangeElsewhere(() => {
      this.expiredNotified = false;
      listener();
    });
  }

  /** The account the stored key belongs to — only set by the authorize flow. */
  async getAccount() {
    return this.store.getAccount();
  }

  async set(value: string | undefined, account?: ApiKeyAccount) {
    if (!value) return void (await this.store.delete());
    await this.store.set(value);
    await this.store.setAccount(account);
    this.expiredNotified = false;
  }

  /**
   * Validates a key the user just supplied. Never touches what's stored, so a
   * bad paste can't delete a working key. Anything that isn't the API
   * rejecting the key (network, rate limit) is re-thrown — "invalid key" is
   * the wrong thing to say when the request never landed.
   */
  async test(apiKey: string): Promise<boolean> {
    try {
      await new SquareCloudAPI(apiKey).account.me();
      return true;
    } catch (error) {
      if (isAuthFailure(error)) return false;
      throw error;
    }
  }

  /**
   * Drops the stored key when the API says the key itself is the problem.
   * Returns whether it did, so callers can stop instead of retrying. A network
   * blip must never wipe a perfectly good key.
   */
  async invalidateIfRejected(error: unknown): Promise<boolean> {
    if (!isAuthFailure(error)) return false;

    // An expired key answers 401 ACCESS_DENIED, exactly like a revoked one,
    // and there is no refresh — the only way back is authorizing again. Only
    // `account.me()` on the stored key lands here, so the 401 is the key's own.
    const rejected = isApiError(error) && error.code === "ACCESS_DENIED";
    await this.set(undefined);
    if (rejected) this.notifyExpired();
    return true;
  }

  private notifyExpired() {
    if (this.expiredNotified) return;
    this.expiredNotified = true;

    void showMessageWithActions(t("setApiKey.connect.expired"), [
      { id: "reconnect", title: t("setApiKey.connect.action") },
    ]).then((choice) => {
      if (choice !== "reconnect") return;
      commands.executeCommand(`${ExtensionID}.setApiKey`);
    });
  }
}
