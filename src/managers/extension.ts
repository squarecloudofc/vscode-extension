import { applicationsStore } from "@/lib/stores/applications";
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
	public readonly treeViews = new TreeViewsManager(this.config);
	public readonly commands = new CommandsManager(this);
	public readonly api = new APIManager(this.config);

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
		applicationsStore.subscribe(() => this.treeViews.refreshAll());

		this.logger.log("Stores initialized!");
	}
}
