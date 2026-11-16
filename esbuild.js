const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * The webview's fonts, copied next to `dist/webview.css`, which loads them by
 * relative URL (`./fonts/...`). Latin and Latin Extended cover the European
 * locales; Japanese and Chinese fall back to the system font.
 */
const FONTS = [
  "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2",
  "@fontsource/fira-mono/files/fira-mono-latin-400-normal.woff2",
  "@fontsource/fira-mono/files/fira-mono-latin-500-normal.woff2",
  "@fontsource/fira-mono/files/fira-mono-latin-ext-400-normal.woff2",
  "@fontsource/fira-mono/files/fira-mono-latin-ext-500-normal.woff2",
];

function copyFonts() {
  const out = path.join(__dirname, "dist", "fonts");
  fs.mkdirSync(out, { recursive: true });
  for (const font of FONTS) {
    fs.copyFileSync(
      path.join(__dirname, "node_modules", font),
      path.join(out, path.basename(font)),
    );
  }
}

/** @type {import('esbuild').BuildOptions} */
const extension = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: "node",
  outfile: "dist/extension.js",
  external: ["vscode"],
  logLevel: "warning",
  alias: {
    "@": "./src",
  },
};

/**
 * Every webview screen (sidebar and panels) in one Preact bundle:
 * `dist/webview.js` plus the `dist/webview.css` its CSS imports produce.
 */
/** @type {import('esbuild').BuildOptions} */
const webview = {
  entryPoints: ["src/webview/main.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  outfile: "dist/webview.js",
  jsx: "automatic",
  jsxImportSource: "preact",
  // Phosphor icons come in as SVG text (src/webview/icons.ts).
  loader: { ".svg": "text" },
  // Copied by copyFonts(), not bundled.
  external: ["./fonts/*"],
  // The component gallery is for scripts/preview: only a dev build has it.
  define: { __PREVIEW__: String(!production) },
  logLevel: "warning",
};

async function main() {
  copyFonts();
  const contexts = await Promise.all(
    [extension, webview].map((options) =>
      esbuild.context({
        ...options,
        plugins: [
          /* add to the end of plugins array */
          esbuildProblemMatcherPlugin,
        ],
      }),
    ),
  );
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      }
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
