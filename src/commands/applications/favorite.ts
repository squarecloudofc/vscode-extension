import { ApplicationCommand } from "@/structures/application/command";

export const favoriteEntry = new ApplicationCommand(
	"favoriteEntry",
	(extension, { application }) => {
		extension.store.actions.toggleFavorite(application.id, true);
	},
);
