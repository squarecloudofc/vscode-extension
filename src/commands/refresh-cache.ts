import { Command } from "@/structures/command";

export const refreshCache = new Command("refreshCache", (extension) =>
  extension.api.refresh(),
);
