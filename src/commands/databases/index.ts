import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env, type MessageItem, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { DatabaseTreeItem } from "@/treeviews/databases/item";
import { Command } from "@/structures/command";

const DATABASE_TYPES = ["mongo", "mysql", "redis", "postgres"] as const;
type DatabaseType = (typeof DATABASE_TYPES)[number];

/** Versions currently accepted by the API per engine. */
const DATABASE_VERSIONS: Record<DatabaseType, string[]> = {
  postgres: ["17.6"],
  mysql: ["9.5"],
  mongo: ["8.0.11"],
  redis: ["7.4.5"],
};

export const createDatabase = new Command(
  "createDatabase",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return;

    const name = await window.showInputBox({
      title: t("database.createTitle"),
      placeHolder: t("database.namePrompt"),
      validateInput: (text) =>
        text.length >= 1 && text.length <= 32
          ? null
          : t("database.invalidName"),
    });
    if (!name) return;

    const type = await window.showQuickPick(DATABASE_TYPES, {
      title: t("database.typePrompt"),
    });
    if (!type) return;

    const memoryStr = await window.showInputBox({
      title: t("database.memoryPrompt"),
      placeHolder: "512",
      validateInput: (text) => {
        const n = Number(text);
        return Number.isInteger(n) && n >= 256
          ? null
          : t("database.invalidMemory");
      },
    });
    if (!memoryStr) return;

    const version = await window.showQuickPick(
      DATABASE_VERSIONS[type as DatabaseType],
      { title: t("database.versionPrompt") },
    );
    if (!version) return;

    const created = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("database.creating"),
      },
      async () => {
        const result = await api.databases.create({
          name,
          memory: Number(memoryStr),
          type: type as DatabaseType,
          version,
        });
        // connection_url embeds the password and is only returned at
        // creation — copy it immediately, it cannot be fetched again.
        await env.clipboard.writeText(result.connection_url);
        await extension.api.refresh();
        return result;
      },
    );

    type CopyPasswordItem = MessageItem & { id: "copy-password" };
    const copyPassword: CopyPasswordItem = {
      title: t("database.copyPassword"),
      id: "copy-password",
    };
    const choice = await window.showInformationMessage<CopyPasswordItem>(
      t("database.createdWithUrl"),
      copyPassword,
    );
    if (choice?.id === "copy-password") {
      await env.clipboard.writeText(created.password);
      window.showInformationMessage(t("database.passwordCopied"));
    }
  },
);

export const startDatabase = new Command(
  "startDatabase",
  async (extension, item: DatabaseTreeItem) => {
    await runDatabaseAction(item, "start");
    extension.api.refresh();
  },
);

export const stopDatabase = new Command(
  "stopDatabase",
  async (extension, item: DatabaseTreeItem) => {
    await runDatabaseAction(item, "stop");
    extension.api.refresh();
  },
);

export const deleteDatabase = new Command(
  "deleteDatabase",
  async (extension, item: DatabaseTreeItem) => {
    const typed = await window.showInputBox({
      title: t("database.deleteConfirm", { NAME: item.database.name }),
      placeHolder: item.database.name,
    });
    if (typed !== item.database.name) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("database.deleting"),
      },
      async () => {
        await item.database.delete();
        await extension.api.refresh();
        window.showInformationMessage(t("database.deleted"));
      },
    );
  },
);

export const downloadDatabaseCertificate = new Command(
  "downloadDatabaseCertificate",
  async (_extension, item: DatabaseTreeItem) => {
    const dialog = await window.showOpenDialog({
      canSelectFolders: true,
      openLabel: t("database.certSave"),
      title: `Certificate - ${item.database.name}`,
    });
    if (!dialog) return;

    const [{ fsPath }] = dialog;

    // Run the actual work inside withProgress so the progress closes as soon
    // as the files hit disk. Showing the success toast inside would block the
    // progress until the user dismissed the toast — see the "infinite
    // loading" bug from before this commit.
    const written = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("database.certDownloading"),
      },
      async () => {
        const encoded = await item.database.credentials.certificate();
        // The SDK returns the bundle base64-encoded; decode to raw PEM.
        const pem = Buffer.from(encoded, "base64").toString("utf-8");

        const certificates =
          pem.match(
            /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
          ) ?? [];
        const privateKeys =
          pem.match(
            /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
          ) ?? [];

        const base = join(fsPath, `database-${item.database.id}`);
        const out: string[] = [];

        // .pem mirrors the raw bundle exactly as Square Cloud returned it.
        await writeFile(`${base}.pem`, pem, "utf-8");
        out.push(".pem");

        if (certificates.length > 0) {
          await writeFile(
            `${base}.crt`,
            `${certificates.join("\n")}\n`,
            "utf-8",
          );
          out.push(".crt");
        }

        if (privateKeys.length > 0) {
          await writeFile(
            `${base}.key`,
            `${privateKeys.join("\n")}\n`,
            "utf-8",
          );
          out.push(".key");
        }

        return out;
      },
    );

    type OpenItem = MessageItem & { id: "open-folder" };
    const openItem: OpenItem = {
      title: t("database.openFolder"),
      id: "open-folder",
    };
    const choice = await window.showInformationMessage<OpenItem>(
      t("database.certDownloaded", { FILES: written.join(", ") }),
      openItem,
    );
    if (choice?.id === "open-folder") {
      env.openExternal(Uri.file(fsPath));
    }
  },
);

async function runDatabaseAction(
  item: DatabaseTreeItem,
  action: "start" | "stop",
) {
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: t(`database.${action}ing`),
    },
    async () => {
      await item.database[action]();
      window.showInformationMessage(t(`database.${action}ed`));
    },
  );
}
