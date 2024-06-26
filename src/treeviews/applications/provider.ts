import { applicationsStore } from "@/lib/stores/applications";
import type { ConfigManager } from "@/managers/config";
import { ApplicationStatus } from "@/structures/application/status";
import ms from "ms";
import { t } from "vscode-ext-localisation";
import { BaseTreeViewProvider } from "../base";
import { GenericTreeItem } from "../items/generic";
import { ApplicationTreeItem, type SquareTreeItem } from "./item";

export type GenericTreeItemData = ConstructorParameters<typeof GenericTreeItem>;

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
	constructor(private readonly config: ConfigManager) {
		super();
	}

	async getChildren(
		element?: SquareTreeItem | undefined,
	): Promise<SquareTreeItem[] | null | undefined> {
		const contextValue =
			element && "contextValue" in element ? element.contextValue : undefined;

		if (
			contextValue?.includes("application") &&
			element instanceof ApplicationTreeItem
		) {
			if (!element.status) {
				return [];
			}

			const status = applicationsStore.get().getStatus(element.application.id);

			if (!status) {
				element.application
					.fetch()
					.then((app) => app.getStatus())
					.then((status) => {
						applicationsStore.get().setStatus(new ApplicationStatus(status));
					});
			}

			const treeItemsData: GenericTreeItemData[] = [
				["CPU", "cpu", element.status.usage?.cpu],
				["RAM", "ram", element.status.usage?.ram],
				[t("generic.loading"), "loading"],
			];

			if (status?.isFull()) {
				const fullStatus = status as ApplicationStatus<true>;
				const uptime = fullStatus.uptimeTimestamp
					? ms(Date.now() - fullStatus.uptimeTimestamp)
					: "Offline";

				treeItemsData.pop();
				treeItemsData.push(
					["Uptime", "uptime", uptime],
					[t("generic.network"), "network", fullStatus.usage.network.now],
					[t("generic.storage"), "storage", fullStatus.usage.storage],
				);
			}

			return treeItemsData.map(
				(parameters) => new GenericTreeItem(...parameters),
			);
		}

		if (!applicationsStore.get().applications.size) {
			const apiKey = await this.config.apiKey.get();

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

		return Array.from(applicationsStore.get().applications.values()).map(
			(app) => new ApplicationTreeItem(app),
		);
	}
}
