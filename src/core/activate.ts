import { SquareCloudExtension } from "@/managers/extension";
import type { ExtensionContext } from "vscode";

export async function activate(context: ExtensionContext): Promise<void> {
	new SquareCloudExtension(context);
}
