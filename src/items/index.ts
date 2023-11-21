import ApplicationTreeItem from "./application.treeitem";
import CustomTreeItem from "./custom.treeitem";
import GenericTreeItem from "./generic.treeitem";

export type SquareTreeItem = ApplicationTreeItem | CustomTreeItem | GenericTreeItem;

export { CustomTreeItem, GenericTreeItem, ApplicationTreeItem };
