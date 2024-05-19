import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function getAllFiles(dir: string, fileExtensions = [".ts", ".js"]) {
	const path = join(__dirname, "..", "..", dir);

	if (!existsSync(path)) {
		return [];
	}

	const rawFiles = readdirSync(path, { withFileTypes: true });
	let files: string[] = [];

	for (const file of rawFiles) {
		if (file.isDirectory()) {
			files = [...files, ...getAllFiles(join(dir, file.name), fileExtensions)];
		}

		if (fileExtensions.some((e) => file.name.endsWith(e))) {
			files.push(join(path, file.name));
		}
	}

	return files;
}
