import { TreeItem } from "vscode";

import { getIcons } from "@/lib/utils/icons";

export class GenericTreeItem extends TreeItem {
  constructor(
    label: string,
    public readonly iconName?: string,
    description?: string,
    contextValue = "generic",
  ) {
    super(label);
    if (iconName) this.iconPath = getIcons(`${iconName}.svg`);
    if (description !== undefined) this.description = description;
    this.contextValue = contextValue;
  }
}
