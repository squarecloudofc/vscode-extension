import type { SecretStorage } from "vscode";
import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { ExtensionID } from "../constants";

const SECRET_KEY = `${ExtensionID}.api-key`;
const LEGACY_PROPERTY = "api-key";

/**
 * Stores the user's API key in VSCode's SecretStorage (OS keychain).
 * On first read, migrates a key from the legacy plaintext auth.json file
 * previously written via `xdg-app-paths`, then removes the legacy file.
 */
export class ApiKeyStore {
  private cached?: string;
  private cacheLoaded = false;
  private migrationAttempted = false;

  constructor(private readonly secrets: SecretStorage) {}

  async get(): Promise<string | undefined> {
    if (this.cacheLoaded) return this.cached;

    let value = await this.secrets.get(SECRET_KEY);
    if (value === undefined && !this.migrationAttempted) {
      this.migrationAttempted = true;
      value = await this.migrateLegacy();
    }

    this.cached = value;
    this.cacheLoaded = true;
    return value;
  }

  async set(apiKey: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, apiKey);
    this.cached = apiKey;
    this.cacheLoaded = true;
  }

  async delete(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
    this.cached = undefined;
    this.cacheLoaded = true;
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
