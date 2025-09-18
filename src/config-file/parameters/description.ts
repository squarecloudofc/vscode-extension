import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

export const DESCRIPTION = {
  required: false,
  validation(_keys, value, line, diagnostics, document) {
    // Validate if exists some value on DESCRIPTION
    if (!value.trim()) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.missing.description"),
        ),
      );
    }

    // Validate if the DESCRIPTION exceeds 280 characters
    if (value.length > 280) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.long.description"),
        ),
      );
    }
  },
} satisfies ConfigFileParameter;
