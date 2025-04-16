import { ApplicationCommand } from "@/structures/application/command";
import { Uri, env } from "vscode";

export const openEntry = new ApplicationCommand(
	"openEntry",
	(_extension, { application }) => {
		env.openExternal(Uri.parse(application.url));
	},
);
