import { Config } from "@/lib/constants";
import { createExtensionStore } from "@/lib/store";
import { Logger } from "@/structures/logger";
import type { ExtensionContext } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";
import { APIManager } from "./api";
import { CommandsManager } from "./commands";
import { ConfigManager } from "./config";
import { TreeViewsManager } from "./treeviews";

export class SquareEasyExtension {
	private readonly logger = new Logger("Square Cloud Easy");

	public readonly config = new ConfigManager(this.context.secrets);
	public readonly treeViews = new TreeViewsManager(this);
	public readonly commands = new CommandsManager(this);
	public readonly api = new APIManager(this);

	public readonly store = createExtensionStore();

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
		console.log(favoritedApps);
		this.store.getState().setFavorited(favoritedApps);

		this.store.subscribe(async (newState, prevState) => {
			if (newState.favorited !== prevState.favorited) {
				await this.config.root.update(
					Config.FavoritedApps.name,
					Array.from(newState.favorited),
					true,
				);
			}
			this.treeViews.refreshAll();
		});

		this.logger.log("Stores initialized!");
	}
}
