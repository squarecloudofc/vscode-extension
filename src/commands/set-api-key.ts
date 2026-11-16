import { Command } from "@/structures/command";

export const setApiKey = new Command("setApiKey", (extension) =>
  extension.views.sidebar.signIn(),
);
