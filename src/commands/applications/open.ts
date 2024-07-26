import { ApplicationCommand } from "@/structures/application/command";
import { Uri, env } from "vscode";

export default new ApplicationCommand(
	"openEntry",
	(_extension, { application }) => {
		env.openExternal(Uri.parse(application.url));
	},
);
