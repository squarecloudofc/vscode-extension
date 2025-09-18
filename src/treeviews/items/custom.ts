import { type Command, TreeItem } from "vscode";

import { getIcons } from "@/lib/utils/icons";

export class CustomTreeItem extends TreeItem {
  iconPath = this.iconName ? getIcons(`${this.iconName}.svg`) : undefined;

  constructor(
    public readonly label: string,
    public readonly command: Command,
    public readonly iconName?: string,
  ) {
    super(label);
  }
}
