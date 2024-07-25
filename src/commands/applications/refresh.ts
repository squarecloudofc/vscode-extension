import { ApplicationCommand } from "@/structures/application/command";

export default new ApplicationCommand(
	"refreshEntry",
	(extension, { application }) => {
		if (extension.api.paused) {
			return;
		}

		extension.api.refreshStatus(application.id);
	},
);
