import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import XDGAppPaths from "xdg-app-paths";

import { ExtensionID } from "../constants";

const property = "api-key";

export class ApiKeyStore {
  private apiKey?: string;
  private authFilePath = path.join(
    XDGAppPaths({ name: ExtensionID }).config(),
    "auth.json",
  );

  async reload(): Promise<void> {
    try {
      const content = await readFile(this.authFilePath, "utf-8");
      const data = JSON.parse(content);
      this.apiKey = (data[property] as string) || undefined;
    } catch {
      // Fallback if file not exists or invalid JSON
      this.apiKey = undefined;
    }
  }

  async set(apiKey: string): Promise<void> {
    await this.reload();
    this.apiKey = apiKey;
    await this.write(apiKey);
  }

  async delete(): Promise<void> {
    await this.reload();
    this.apiKey = undefined;
    await this.write(undefined);
  }

  async get(): Promise<string | undefined> {
    if (this.apiKey === undefined) {
      await this.reload();
    }
    return this.apiKey;
  }

  private async write(apiKey: string | undefined): Promise<void> {
    await mkdir(path.dirname(this.authFilePath), { recursive: true });
    await writeFile(
      this.authFilePath,
      JSON.stringify({ [property]: apiKey }, null, 2),
    );
  }
}
