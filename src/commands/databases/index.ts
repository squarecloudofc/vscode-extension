import type { Database } from "@squarecloud/api";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { showMessageWithActions } from "@/lib/utils/dialogs";
import { Command } from "@/structures/command";

const DATABASE_TYPES = ["mongo", "mysql", "redis", "postgres"] as const;
type DatabaseType = (typeof DATABASE_TYPES)[number];

/** Major version keys currently accepted by the API per engine. */
const DATABASE_VERSIONS: Record<DatabaseType, string[]> = {
  postgres: ["17"],
  mysql: ["9"],
  mongo: ["8"],
  redis: ["7"],
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

    // "Other..." keeps the command usable when the platform rotates versions
    // faster than the extension ships updates to the hardcoded list.
    const customVersion = t("database.customVersion");
    const picked = await window.showQuickPick(
      [...DATABASE_VERSIONS[type as DatabaseType], customVersion],
      { title: t("database.versionPrompt") },
    );
    if (!picked) return;
    const version =
      picked === customVersion
        ? await window.showInputBox({
            title: t("database.versionPrompt"),
            placeHolder: DATABASE_VERSIONS[type as DatabaseType][0],
          })
        : picked;
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

    const choice = await showMessageWithActions(t("database.createdWithUrl"), [
      { id: "copy-password", title: t("database.copyPassword") },
    ]);
    if (choice === "copy-password") {
      await env.clipboard.writeText(created.password);
      window.showInformationMessage(t("database.passwordCopied"));
    }
  },
);

export const startDatabase = new Command(
  "startDatabase",
  async (extension, item: { database: Database }) => {
    await runDatabaseAction(item, "start");
    extension.api.refresh();
  },
);

export const stopDatabase = new Command(
  "stopDatabase",
  async (extension, item: { database: Database }) => {
    await runDatabaseAction(item, "stop");
    extension.api.refresh();
  },
);

export const deleteDatabase = new Command(
  "deleteDatabase",
  async (extension, item: { database: Database }) => {
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
  async (_extension, item: { database: Database }) => {
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

    const choice = await showMessageWithActions(
      t("database.certDownloaded", { FILES: written.join(", ") }),
      [{ id: "open-folder", title: t("database.openFolder") }],
    );
    if (choice === "open-folder") {
      env.openExternal(Uri.file(fsPath));
    }
  },
);

async function runDatabaseAction(
  item: { database: Database },
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
