import { type Command, TreeItem } from "vscode";

import { getIcons } from "@/lib/utils/icons";

export class CustomTreeItem extends TreeItem {
  constructor(label: string, command: Command, iconName?: string) {
    super(label);
    this.command = command;
    if (iconName) this.iconPath = getIcons(`${iconName}.svg`);
  }
}
