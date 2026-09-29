import type {
  DatabaseSummary,
  DatabaseType,
  SquareCloudAPI,
} from "@squarecloud/api";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { commands, env, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";
import { showMessageWithActions } from "@/lib/utils/dialogs";
import { Command } from "@/structures/command";

const DATABASE_TYPES: DatabaseType[] = ["mongo", "mysql", "redis", "postgres"];

/** Major version keys currently accepted by the API per engine. */
const DATABASE_VERSIONS: Record<DatabaseType, string[]> = {
  postgres: ["17"],
  mysql: ["9"],
  mongo: ["8"],
  redis: ["7"],
};

interface DatabaseTarget {
  database: DatabaseSummary;
}

/**
 * A database action gets its database from the ⋯ menu; from the palette or a
 * walkthrough link it gets nothing and asks. Like `ApplicationCommand`, it
 * opens sign-in when no account is connected.
 */
function databaseCommand(
  name: string,
  handler: (
    extension: SquareCloudExtension,
    item: DatabaseTarget,
    api: SquareCloudAPI,
  ) => unknown,
): Command {
  return new Command(name, async (extension, item?: DatabaseTarget) => {
    const api = await extension.api.getClient();
    if (!api) return extension.treeViews.auth.reveal();
    const database = item?.database ?? (await pickDatabase(extension));
    if (database) await handler(extension, { database }, api);
  });
}

async function pickDatabase(
  extension: SquareCloudExtension,
): Promise<DatabaseSummary | undefined> {
  const { databases } = extension.store.value;
  if (!databases.size) {
    const choice = await showMessageWithActions(t("database.empty"), [
      { id: "create", title: t("command.createDatabase") },
    ]);
    if (choice === "create") {
      void commands.executeCommand(`${ExtensionID}.createDatabase`);
    }
    return undefined;
  }
  const picked = await window.showQuickPick(
    Array.from(databases.values(), (database) => ({
      label: database.name,
      // The store has no database status, only what the listing carries.
      description: `${database.type} · ${database.ram} MB`,
      database,
    })),
    { placeHolder: t("database.pick") },
  );
  return picked?.database;
}

export const createDatabase = new Command(
  "createDatabase",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return extension.treeViews.auth.reveal();

    const name = await window.showInputBox({
      title: t("database.createTitle"),
      placeHolder: t("database.namePrompt"),
      validateInput: (text) =>
        text.length >= 1 && text.length <= 32
          ? null
          : t("database.invalidName"),
    });
    if (!name) return;

    const type = (await window.showQuickPick(DATABASE_TYPES, {
      title: t("database.typePrompt"),
    })) as DatabaseType | undefined;
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
    // faster than the extension ships updates to the hardcoded list. The pencil
    // sets it apart from the real versions above it.
    const customVersion = `$(edit) ${t("database.customVersion")}`;
    const picked = await window.showQuickPick(
      [...DATABASE_VERSIONS[type], customVersion],
      { title: t("database.versionPrompt") },
    );
    if (!picked) return;
    const version =
      picked === customVersion
        ? await window.showInputBox({
            title: t("database.versionPrompt"),
            placeHolder: DATABASE_VERSIONS[type][0],
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
          type,
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

export const startDatabase = databaseCommand(
  "startDatabase",
  async (extension, item, api) => {
    await runDatabaseAction(api, item, "start");
    extension.api.refresh();
  },
);

export const stopDatabase = databaseCommand(
  "stopDatabase",
  async (extension, item, api) => {
    await runDatabaseAction(api, item, "stop");
    extension.api.refresh();
  },
);

export const deleteDatabase = databaseCommand(
  "deleteDatabase",
  async (extension, item, api) => {
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
        await api.databases.delete(item.database.id);
        await extension.api.refresh();
        window.showInformationMessage(t("database.deleted"));
      },
    );
  },
);

export const downloadDatabaseCertificate = databaseCommand(
  "downloadDatabaseCertificate",
  async (_extension, item, api) => {
    const dialog = await window.showOpenDialog({
      // Files default to selectable too, and macOS then lets one be picked.
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: t("database.certSave"),
      title: `${t("command.downloadDatabaseCertificate")} - ${item.database.name}`,
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
        const encoded = await api.databases.certificate(item.database.id);
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
        // The bundle and the .key hold the private key: owner-only, which
        // libpq also insists on. Applies to new files only: one written by an
        // older version keeps its mode.
        const secret = { encoding: "utf-8", mode: 0o600 } as const;

        // .pem mirrors the raw bundle exactly as Square Cloud returned it.
        await writeFile(`${base}.pem`, pem, secret);
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
          await writeFile(`${base}.key`, `${privateKeys.join("\n")}\n`, secret);
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
  api: SquareCloudAPI,
  item: DatabaseTarget,
  action: "start" | "stop",
) {
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      // Spelled out: `${action}ing` made "stoping", a key that does not
      // exist, and literal keys are what check-strings can verify.
      title:
        action === "start" ? t("database.starting") : t("database.stopping"),
    },
    async () => {
      await api.databases[action](item.database.id);
      window.showInformationMessage(
        action === "start" ? t("database.started") : t("database.stopped"),
      );
    },
  );
}
