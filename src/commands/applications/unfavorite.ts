import { ApplicationCommand } from "@/structures/application/command";

export default new ApplicationCommand(
	"unfavoriteEntry",
	(extension, { application }) => {
		extension.store.getState().toggleFavorite(application.id, false);
	},
);
