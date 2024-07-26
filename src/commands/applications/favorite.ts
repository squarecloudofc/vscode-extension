import { ApplicationCommand } from "@/structures/application/command";

export default new ApplicationCommand(
	"favoriteEntry",
	(extension, { application }) => {
		extension.store.actions.toggleFavorite(application.id, true);
	},
);
