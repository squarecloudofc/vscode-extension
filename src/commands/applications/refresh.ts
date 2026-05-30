import { ApplicationCommand } from "@/structures/application/command";

export const refreshEntry = new ApplicationCommand(
  "refreshEntry",
  (extension, { application }) => {
    extension.api.refreshStatus(application.id);
  },
);
