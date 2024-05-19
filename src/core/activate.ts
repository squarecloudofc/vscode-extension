import applicationsStore from "@/lib/stores/applications";
import { config } from "@/managers/config";
import { listeners } from "@/managers/listeners";
import { treeViews } from "@/managers/treeviews";
import type { ExtensionContext } from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

export async function setUpExtension(context: ExtensionContext, lang: string) {
	console.log("[Square Cloud Easy] Starting!");
	loadTranslations(lang, context.extensionPath);

	config.setSecretStorage(context.secrets);
	listeners.register(context);
	treeViews.register();

	applicationsStore.subscribe(() => treeViews.refreshAll());
	applicationsStore.persist({ name: "applications", context });
}

export async function activate(context: ExtensionContext): Promise<void> {
	await setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
