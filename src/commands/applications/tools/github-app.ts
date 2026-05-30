import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { ApplicationCommand } from "@/structures/application/command";

export const linkGithubAppEntry = new ApplicationCommand(
  "linkGithubAppEntry",
  async (_extension, { application }) => {
    const repositoryName = await window.showInputBox({
      title: t("githubApp.linkTitle"),
      placeHolder: "octocat/hello-world",
      prompt: t("githubApp.repoPrompt"),
      validateInput: (text) =>
        /^[\w.-]+\/[\w.-]+$/.test(text) ? null : t("githubApp.invalidRepo"),
    });
    if (!repositoryName) return;

    const repositoryBranch = await window.showInputBox({
      title: t("githubApp.linkTitle"),
      placeHolder: "main",
      prompt: t("githubApp.branchPrompt"),
      value: "main",
    });
    if (!repositoryBranch) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("githubApp.linking"),
      },
      async () => {
        await application.deploys.linkGithubApp({
          repositoryName,
          repositoryBranch,
        });
        window.showInformationMessage(t("githubApp.linked"));
      },
    );
  },
);

export const unlinkGithubAppEntry = new ApplicationCommand(
  "unlinkGithubAppEntry",
  async (_extension, { application }) => {
    if (!(await confirm(t("githubApp.confirmUnlink")))) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("githubApp.unlinking"),
      },
      async () => {
        await application.deploys.unlinkGithubApp();
        window.showInformationMessage(t("githubApp.unlinked"));
      },
    );
  },
);
