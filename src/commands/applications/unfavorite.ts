import { ApplicationCommand } from "@/structures/application/command";

export const unfavoriteEntry = new ApplicationCommand(
  "unfavoriteEntry",
  (extension, { application }) => {
    extension.store.actions.toggleFavorite(application.id, false);
  },
);
