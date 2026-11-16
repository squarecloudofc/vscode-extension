import { Command } from "@/structures/command";

/** The Blob panel (its sidebar row shows only when the key and plan have Blob). */
export const openBlob = new Command("openBlob", async (extension) => {
  if (!(await extension.api.getClient()))
    return extension.views.sidebar.signIn();
  extension.panels.openResource("blob", "account");
});
