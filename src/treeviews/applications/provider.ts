import ms from "ms";
import { t } from "vscode-ext-localisation";
import { coreConfig } from "../../config/core";
import applications from "../../store/applications";
import { BaseTreeViewProvider } from "../base";
import { GenericTreeItem } from "../items/generic";
import { ApplicationTreeItem, type SquareTreeItem } from "./item";

export type GenericTreeItemData = ConstructorParameters<typeof GenericTreeItem>;

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
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

			const fullStatus = applications
				.get()
				.getFullStatus(element.application.id);

			if (!fullStatus) {
				element.application
					.fetch()
					.then((app) => app.getStatus())
					.then((fullStatus) => {
						applications.get().addFullStatus(fullStatus);
					});
			}

			const treeItemsData: GenericTreeItemData[] = [
				["CPU", "cpu", element.status.usage?.cpu],
				["RAM", "ram", element.status.usage?.ram],
				[t("generic.loading"), "loading"],
			];

			if (fullStatus) {
				const uptime = fullStatus?.uptimeTimestamp
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

		if (!applications.get().applications.length) {
			const apiKey = await coreConfig.getApiKey();

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

		return applications
			.get()
			.applications.map((app) => new ApplicationTreeItem(app));
	}
}
