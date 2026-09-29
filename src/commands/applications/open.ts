import { env, Uri } from "vscode";

import { ApplicationCommand } from "@/structures/application/command";

export const openEntry = new ApplicationCommand(
  "openEntry",
  (_extension, { application }) => {
    env.openExternal(
      Uri.parse(`https://squarecloud.app/dashboard/app/${application.id}`),
    );
  },
);
