import { type Disposable, commands as vscommands } from "vscode";

import { ApplicationCommand } from "@/structures/application/command";
import { Command } from "@/structures/command";
import { Logger } from "@/structures/logger";

import type { SquareCloudExtension } from "./extension";
import * as commandExports from "../commands";

type AnyCommand = Command | ApplicationCommand;

function isCommand(value: unknown): value is AnyCommand {
  return value instanceof Command || value instanceof ApplicationCommand;
}

export class CommandsManager implements Disposable {
  private readonly logger = new Logger("Commands");
  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    let count = 0;
    // The `commands` barrel re-exports a few helper functions (e.g. realtime's
    // disposeAllRealtimeSessions) alongside actual Command instances. Filter
    // by instanceof so we don't register phantom commands named after
    // utilities and crash later when VSCode invokes them.
    for (const exported of Object.values(commandExports)) {
      if (!isCommand(exported)) continue;
      this.disposables.push(
        vscommands.registerCommand(exported.name, (...args) =>
          exported.execute(this.extension, ...(args as [never, ...never[]])),
        ),
      );
      count++;
    }
    this.logger.log(`Loaded ${count} commands.`);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
