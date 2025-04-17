import { capitalize } from "@/lib/utils/capitalize";
import { formatMB } from "@/lib/utils/format";
import type { SquareCloudExtension } from "@/managers/extension";
import { t } from "vscode-ext-localisation";
import { BaseTreeViewProvider } from "../base";
import { GenericTreeItem } from "../items/generic";

export class UserTreeViewProvider extends BaseTreeViewProvider<GenericTreeItem> {
	constructor(private readonly extension: SquareCloudExtension) {
		super();
	}

	async getChildren(): Promise<GenericTreeItem[] | null | undefined> {
		const { user } = this.extension.store.value;

		if (!user) {
			const apiKey = await this.extension.config.apiKey.get();

			if (!apiKey) {
				return [];
			}

			return [
				new GenericTreeItem(
					t("generic.loading"),
					"loading",
					undefined,
					"loading",
				),
			];
		}

		const expires = user.plan.expiresIn?.toLocaleDateString("pt-BR", {
			dateStyle: "short",
		});

		const treeItemsData: [string, string, string][] = [
			["Username", "username", user.name],
			["ID", "id", user.id],
			["E-mail", "email", user.email],
			[capitalize(user.plan.name).replace("-", " "), "plan", expires || "∞"],
			[
				"RAM",
				"ram",
				`${formatMB(user.plan.memory.used, true)}/${formatMB(user.plan.memory.limit)}`,
			],
		];

		return treeItemsData.map(
			(treeItemData) => new GenericTreeItem(...treeItemData),
		);
	}
}
