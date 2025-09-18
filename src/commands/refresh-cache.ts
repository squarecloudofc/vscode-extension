import { Command } from "@/structures/command";

export const refreshCache = new Command("refreshCache", async (extension) => {
  await extension.api.refresh();
});
