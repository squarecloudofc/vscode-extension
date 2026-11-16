import { type Disposable, type ExtensionContext, workspace } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

import { offerWalkthroughOnce } from "@/commands/get-started";
import { Config } from "@/lib/constants";
import { $extensionStore, selectAndSubscribe } from "@/lib/store";
import { PanelManager } from "@/panels/panel-manager";
import { AppFileSystem } from "@/providers/files";
import { SquareCloudMcp } from "@/providers/mcp";
import { Logger } from "@/structures/logger";
import { FILES_SCHEME } from "@/webview/lib/files";

import { APIManager } from "./api";
import { CommandsManager } from "./commands";
import { ConfigManager } from "./config";
import { ConfigFileManager } from "./config-file";
import { StatusBarManager } from "./status-bar";
import { ViewsManager } from "./views";

export class SquareCloudExtension implements Disposable {
  private readonly logger = new Logger("Extension");

  public readonly config: ConfigManager;
  public readonly configFile: ConfigFileManager;
  public readonly views: ViewsManager;
  public readonly commands: CommandsManager;
  public readonly api: APIManager;
  public readonly statusBar: StatusBarManager;
  public readonly panels: PanelManager;
  /** Square Cloud's tools in agent mode, for a key with the `mcp` scope. */
  public readonly mcp: SquareCloudMcp;
  /** Apps' files as `squarecloud://app/<appId>/<path>`. */
  public readonly files = new AppFileSystem(() => this.api.getClient());

  public readonly store = $extensionStore;

  private readonly disposables: Disposable[] = [];

  constructor(public readonly context: ExtensionContext) {
    this.logger.log("Initializing extension...");

    // Translations must load BEFORE any manager that calls t() during init.
    this.loadLanguage();

    this.config = new ConfigManager(context.secrets);
    this.mcp = new SquareCloudMcp(this.config.apiKey);
    this.configFile = new ConfigFileManager(this);
    this.views = new ViewsManager(this);
    this.commands = new CommandsManager(this);
    this.api = new APIManager(this);
    this.statusBar = new StatusBarManager(this);
    this.panels = new PanelManager(this);

    this.disposables.push(
      this.api,
      this.commands,
      this.configFile,
      this.views,
      this.statusBar,
      this.panels,
      this.mcp,
      workspace.registerFileSystemProvider(FILES_SCHEME, this.files, {
        isCaseSensitive: true,
      }),
    );

    this.initializeStores();

    // Connecting or disconnecting in one window applies to all of them.
    this.disposables.push(
      this.config.apiKey.onDidChangeElsewhere(
        () => void this.api.restartForNewKey(),
      ),
    );

    // Sign-in or the account: the sidebar shows its skeleton until this has
    // read the stored key.
    void this.views.sidebar.sync();
    void offerWalkthroughOnce(this);
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
