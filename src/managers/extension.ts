import { Config } from "@/lib/constants";
import { $extensionStore } from "@/lib/store";
import { Logger } from "@/structures/logger";
import type { ExtensionContext } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";
import { APIManager } from "./api";
import { CommandsManager } from "./commands";
import { ConfigManager } from "./config";
import { ConfigFileManager } from "./config-file";
import { TreeViewsManager } from "./treeviews";

export class SquareEasyExtension {
	private readonly logger = new Logger("Square Cloud Easy");

	public readonly config = new ConfigManager(this.context.secrets);
	public readonly configFile = new ConfigFileManager(this);
	public readonly treeViews = new TreeViewsManager(this);
	public readonly commands = new CommandsManager(this);
	public readonly api = new APIManager(this);

	public readonly store = $extensionStore;

	constructor(public readonly context: ExtensionContext) {
		this.logger.log("Initializing extension...");

		this.loadLanguage();
		this.initializeStores();

		this.logger.log("Extension is ready!");
	}

	loadLanguage() {
		loadTranslations(
			getVscodeLang(process.env.VSCODE_NLS_CONFIG),
			this.context.extensionPath,
		);

		this.logger.log("Language loaded!");
	}

	initializeStores() {
		const favoritedApps = this.config.root.get<string[]>(
			Config.FavoritedApps.name,
			[],
		);

		this.store.actions.setFavorited(favoritedApps);

		this.store.subscribe((state) => {
			this.config.root.update(
				Config.FavoritedApps.name,
				Array.from(state.favorited),
				true,
			);
			this.treeViews.refreshAll();
		});

		this.logger.log("Stores initialized!");
	}
}
