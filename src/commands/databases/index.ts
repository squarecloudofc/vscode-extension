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
import { getLocale } from "@/lib/utils/locale";
import { Command } from "@/structures/command";
import { formatBytes } from "@/webview/lib/format";

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
    if (!api) return extension.views.sidebar.signIn();
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
      description: `${database.type} · ${formatBytes(database.ram * 1024 ** 2, getLocale(), 1)}`,
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
    if (!api) return extension.views.sidebar.signIn();

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

    // Progress in the status bar: the one notification is the toast after
    // it, which says the URL was copied and offers the password.
    const created = await window.withProgress(
      {
        location: ProgressLocation.Window,
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
      },
    );
  },
);

export const databaseMetrics = databaseCommand(
  "databaseMetrics",
  (extension, { database }) =>
    extension.panels.openResource("database", database.id, "metrics"),
);

export const downloadDatabaseCertificate = databaseCommand(
  "downloadDatabaseCertificate",
  async (_extension, item, api) => {
    const dialog = await window.showOpenDialog({
      // Files default to selectable too, and macOS then lets one be picked.
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: t("database.certSave"),
      title: `${t("database.certDownload")} - ${item.database.name}`,
    });
    if (!dialog) return;

    const [{ fsPath }] = dialog;

    // Progress in the status bar: the one notification is the toast after
    // it, which names the files and opens their folder.
    const written = await window.withProgress(
      {
        location: ProgressLocation.Window,
        title: t("database.certDownloading"),
      },
      async () =>
        writeCertificate(
          fsPath,
          item.database.id,
          await api.databases.certificate(item.database.id),
        ),
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

/**
 * Writes the database's TLS bundle (base64 PEM, as the API sends it) into
 * `fsPath` as `database-<id>.pem`, plus `.crt` and `.key` when it holds
 * them. The extensions written. The database panel saves it the same way.
 */
export async function writeCertificate(
  fsPath: string,
  id: string,
  encoded: string,
): Promise<string[]> {
  const pem = Buffer.from(encoded, "base64").toString("utf-8");

  const certificates =
    pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    ) ?? [];
  const privateKeys =
    pem.match(
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    ) ?? [];

  const base = join(fsPath, `database-${id}`);
  const out: string[] = [];
  // The bundle and the .key hold the private key: owner-only, which
  // libpq also insists on. Applies to new files only: one written by an
  // older version keeps its mode.
  const secret = { encoding: "utf-8", mode: 0o600 } as const;

  // .pem mirrors the raw bundle exactly as Square Cloud returned it.
  await writeFile(`${base}.pem`, pem, secret);
  out.push(".pem");

  if (certificates.length > 0) {
    await writeFile(`${base}.crt`, `${certificates.join("\n")}\n`, "utf-8");
    out.push(".crt");
  }

  if (privateKeys.length > 0) {
    await writeFile(`${base}.key`, `${privateKeys.join("\n")}\n`, secret);
    out.push(".key");
  }
  return out;
}

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
    () => api.databases[action](item.database.id),
  );
}
