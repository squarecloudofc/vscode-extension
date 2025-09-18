import { ApplicationCommand } from "@/structures/application/command";

export const refreshEntry = new ApplicationCommand(
  "refreshEntry",
  (extension, { application }) => {
    if (extension.api.paused) {
      return;
    }

    extension.api.refreshStatus(application.id);
  },
);
