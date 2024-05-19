import { Constant } from "@/structures/constant";

export const ExtensionID = "squarecloud";

export const Config = {
	APIKey: new Constant("apiKey", ExtensionID),
	FavoritedApps: new Constant("favApps", ExtensionID),
};
