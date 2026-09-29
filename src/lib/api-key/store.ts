import type { Disposable, SecretStorage } from "vscode";
import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { ExtensionID } from "../constants";

const SECRET_KEY = `${ExtensionID}.api-key`;
const ACCOUNT_KEY = `${ExtensionID}.api-key.account`;
const LEGACY_PROPERTY = "api-key";

/** Who the stored key belongs to, as returned by the authorize claim. */
export interface ApiKeyAccount {
  id: string;
  email: string;
  scopes?: string[];
  expiresAt?: string;
}

/**
 * Stores the user's API key in VSCode's SecretStorage (OS keychain).
 * On first read, migrates a key from the legacy plaintext auth.json file
 * previously written via `xdg-app-paths`, then removes the legacy file.
 */
export class ApiKeyStore {
  private cached?: string;
  private cacheLoaded = false;
  private migrationAttempted = false;
  private loading?: Promise<string | undefined>;

  constructor(private readonly secrets: SecretStorage) {}

  async get(): Promise<string | undefined> {
    if (this.cacheLoaded) return this.cached;
    // Activation asks from several places at once. They share one read, or
    // all but the first get "no key" while the legacy migration runs.
    this.loading ??= this.load().finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  private async load(): Promise<string | undefined> {
    let value = await this.secrets.get(SECRET_KEY);
    if (value === undefined && !this.migrationAttempted) {
      this.migrationAttempted = true;
      value = await this.migrateLegacy();
    }

    // A set() or delete() that landed during the read is newer than it.
    if (this.cacheLoaded) return this.cached;
    this.cached = value;
    this.cacheLoaded = true;
    return value;
  }

  // Both writes cache first: the change event they fire has to find the new
  // value already here, or this window takes its own write for another's.
  async set(apiKey: string): Promise<void> {
    this.cached = apiKey;
    this.cacheLoaded = true;
    await this.secrets.store(SECRET_KEY, apiKey);
  }

  async delete(): Promise<void> {
    this.cached = undefined;
    this.cacheLoaded = true;
    await this.secrets.delete(SECRET_KEY);
    await this.setAccount(undefined);
  }

  /**
   * Fires when another VS Code window stores or deletes the key: SecretStorage
   * is shared by every window of the profile. This window's own writes are
   * already cached, so they don't fire it.
   */
  onDidChangeElsewhere(listener: () => void): Disposable {
    return this.secrets.onDidChange(async ({ key }) => {
      if (key !== SECRET_KEY) return;
      // A keychain that can't be read now is no news: keep what we have.
      const value = await this.secrets.get(SECRET_KEY).then(
        (stored) => stored,
        () => this.cached,
      );
      if (this.cacheLoaded && value === this.cached) return;
      this.cached = value;
      this.cacheLoaded = true;
      listener();
    });
  }

  async getAccount(): Promise<ApiKeyAccount | undefined> {
    const raw = await this.secrets.get(ACCOUNT_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as ApiKeyAccount;
    } catch {
      return undefined;
    }
  }

  async setAccount(account: ApiKeyAccount | undefined): Promise<void> {
    if (!account) return void (await this.secrets.delete(ACCOUNT_KEY));
    await this.secrets.store(ACCOUNT_KEY, JSON.stringify(account));
  }

  /**
   * Reads the legacy plaintext file written by previous versions, copies the
   * key into SecretStorage, then removes the file so it does not linger on
   * disk in plaintext.
   */
  private async migrateLegacy(): Promise<string | undefined> {
    for (const candidate of legacyAuthPaths()) {
      const content = await readFile(candidate, "utf-8").catch(() => null);
      if (content === null) continue;

      let apiKey: string | undefined;
      try {
        const data = JSON.parse(content);
        apiKey =
          typeof data?.[LEGACY_PROPERTY] === "string"
            ? data[LEGACY_PROPERTY]
            : undefined;
      } catch {
        // Corrupt JSON — drop and keep looking.
      }

      if (apiKey) {
        await this.secrets.store(SECRET_KEY, apiKey);
      }
      // Always remove the plaintext file once we've inspected it.
      await rm(candidate, { force: true }).catch(() => {});
      if (apiKey) return apiKey;
    }
    return undefined;
  }
}

/**
 * Possible historical locations of `auth.json`, in order of likelihood.
 * Mirrors the platform layout used by `xdg-app-paths@^8`.
 */
function legacyAuthPaths(): string[] {
  const name = ExtensionID;
  const fileName = "auth.json";
  const home = homedir();

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    return [join(appData, "xdg.config", name, fileName)];
  }

  if (process.platform === "darwin") {
    return [join(home, "Library", "Preferences", name, fileName)];
  }

  const xdg = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  return [join(xdg, name, fileName)];
}
