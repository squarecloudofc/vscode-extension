import { ApplicationCommand } from "@/structures/application/command";

export default new ApplicationCommand(
	"favoriteEntry",
	(extension, { application }) => {
		extension.store.getState().toggleFavorite(application.id, true);
	},
);
