import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

export const START = {
  required: false,
  validation(_keys, value, line, diagnostics, document) {
    // Validate if exists some value on START
    if (!value) {
      diagnostics.push(
        createDiagnostic(document, line, t("configFile.error.missing.start")),
      );
    }

    // Validate if the START exceeds 256 characters (official docs limit)
    if (value.length > 256) {
      diagnostics.push(
        createDiagnostic(document, line, t("configFile.error.long.start")),
      );
    }
  },
} satisfies ConfigFileParameter;
