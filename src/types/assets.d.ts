/** SVGs are bundled as text by esbuild (see `loader` in esbuild.js). */
declare module "*.svg" {
  const markup: string;
  export default markup;
}

/** The webview's stylesheets: esbuild bundles them into dist/webview.css. */
declare module "*.css";

/** False in the production bundle (esbuild `define`): the preview's gallery is left out. */
declare const __PREVIEW__: boolean;
