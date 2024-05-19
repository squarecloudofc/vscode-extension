import { ExtensionID } from "@/lib/constants";
import { type SecretStorage, workspace } from "vscode";

export class ConfigManager {
	readonly secrets?: SecretStorage;

	get root() {
		return workspace.getConfiguration(ExtensionID);
	}

	setSecretStorage(secrets: SecretStorage) {
		Reflect.set(this, "secrets", secrets);
	}
}

export const config = new ConfigManager();
