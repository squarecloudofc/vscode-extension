import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

export const DISPLAY_NAME = {
  required: true,
  validation(_keys, value, line, diagnostics, document) {
    // Validate if exists some value on DISPLAY_NAME
    if (!value.trim()) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.missing.displayName"),
        ),
      );
    }

    // Validate if the DISPLAY_NAME exceeds 32 characters
    if (value.length > 32) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.long.displayName"),
        ),
      );
    }
  },
} satisfies ConfigFileParameter;
