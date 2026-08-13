import type { Disposable, ExtensionContext } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

import { Config } from "@/lib/constants";
import { $extensionStore, selectAndSubscribe } from "@/lib/store";
import { Logger } from "@/structures/logger";

import { APIManager } from "./api";
import { CommandsManager } from "./commands";
import { ConfigManager } from "./config";
import { ConfigFileManager } from "./config-file";
import { StatusBarManager } from "./status-bar";
import { TreeViewsManager } from "./treeviews";

export class SquareCloudExtension implements Disposable {
  private readonly logger = new Logger("Extension");

  public readonly config: ConfigManager;
  public readonly configFile: ConfigFileManager;
  public readonly treeViews: TreeViewsManager;
  public readonly commands: CommandsManager;
  public readonly api: APIManager;
  public readonly statusBar: StatusBarManager;

  public readonly store = $extensionStore;

  private readonly disposables: Disposable[] = [];

  constructor(public readonly context: ExtensionContext) {
    this.logger.log("Initializing extension...");

    // Translations must load BEFORE any manager that calls t() during init.
    this.loadLanguage();

    this.config = new ConfigManager(context.secrets);
    this.configFile = new ConfigFileManager(this);
    this.treeViews = new TreeViewsManager(this);
    this.commands = new CommandsManager(this);
    this.api = new APIManager(this);
    this.statusBar = new StatusBarManager(this);

    this.disposables.push(
      this.api,
      this.commands,
      this.configFile,
      this.treeViews,
      this.statusBar,
    );

    this.initializeStores();

    // Decides which half of the sidebar renders — the sign-in view or the
    // trees. Runs before anything can paint so nobody sees the wrong one.
    void this.treeViews.auth.syncVisibility();

    this.logger.log("Extension is ready!");
  }

  private loadLanguage() {
    loadTranslations(
      getVscodeLang(process.env.VSCODE_NLS_CONFIG),
      this.context.extensionPath,
    );
    this.logger.log("Language loaded.");
  }

  private initializeStores() {
    const favoritedApps = this.config.root.get<string[]>(
      Config.FavoritedApps,
      [],
    );
    this.store.actions.setFavorited(favoritedApps);

    // Persist favorites only when they actually change — was previously firing
    // a config.update() on every store tick.
    this.disposables.push(
      selectAndSubscribe(
        (s) => s.favorited,
        (favorited) => {
          this.config.root.update(
            Config.FavoritedApps,
            Array.from(favorited),
            true,
          );
        },
      ),
    );

    this.logger.log("Stores initialized.");
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    Logger.dispose();
  }
}
