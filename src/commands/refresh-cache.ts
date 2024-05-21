import { Command } from "@/structures/command";

export default new Command("refreshCache", async (extension) => {
	await extension.api.refresh();
});
