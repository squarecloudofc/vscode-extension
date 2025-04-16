import { Command } from "@/structures/command";
import type { GenericTreeItem } from "@/treeviews/items/generic";
import { env, window } from "vscode";
import { t } from "vscode-ext-localisation";

export const copyText = new Command(
	"copyText",
	(_extension, treeItem: GenericTreeItem) => {
		if (!treeItem.description) {
			return;
		}

		env.clipboard.writeText(treeItem.description);
		window.showInformationMessage(
			t("copy.copiedText", { TYPE: treeItem.label }),
		);
	},
);
