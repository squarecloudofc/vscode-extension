import { coreConfig } from "@/config/core";
import { listenersManager } from "@/listeners/manager";
import applicationsStore from "@/stores/applications";
import { treeViewsManager } from "@/treeviews/manager";
import type { ExtensionContext } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

export async function setUpExtension(context: ExtensionContext, lang: string) {
	console.log("[Square Cloud Easy] Starting!");
	loadTranslations(lang, context.extensionPath);

	coreConfig.setSecretStorage(context.secrets);
	listenersManager.register(context);
	treeViewsManager.register();

	applicationsStore.subscribe(() => treeViewsManager.refreshAll());
	applicationsStore.persist({ name: "applications", context });
}

export async function activate(context: ExtensionContext): Promise<void> {
	await setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
