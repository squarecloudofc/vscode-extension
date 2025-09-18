import { TreeItem } from "vscode";

import { getIcons } from "@/lib/utils/icons";

export class GenericTreeItem extends TreeItem {
  iconPath = this.iconName ? getIcons(`${this.iconName}.svg`) : undefined;

  constructor(
    public readonly label: string,
    public readonly iconName?: string,
    public readonly description?: string,
    public readonly contextValue: string = "generic",
  ) {
    super(label);
    this.description = description;
  }
}
