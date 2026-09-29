/** SVGs are bundled as text by esbuild (see `loader` in esbuild.js). */
declare module "*.svg" {
  const markup: string;
  export default markup;
}
