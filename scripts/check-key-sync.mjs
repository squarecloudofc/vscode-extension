/**
 * Every VS Code window shares one SecretStorage. A key stored or deleted in
 * another window must reach this one; this window's own writes must not come
 * back as if they were someone else's (that would cut the connect animation
 * short and refetch everything).
 *
 *   node scripts/check-key-sync.mjs
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "sq-key-sync-"));
// An empty store runs the legacy auth.json migration, which deletes that
// file: point every place it looks at the temp folder, never the real one.
process.env.APPDATA = dir;
process.env.XDG_CONFIG_HOME = dir;
process.env.HOME = dir;
process.env.USERPROFILE = dir;
const bundle = join(dir, "store.mjs");
await esbuild.build({
  entryPoints: ["src/lib/api-key/store.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
});
const { ApiKeyStore } = await import(pathToFileURL(bundle).href);

/** A SecretStorage shared by two windows: every write fires in both. */
function sharedSecrets() {
  const values = new Map();
  const listeners = new Set();
  const fire = (key) => {
    for (const listener of listeners) listener({ key });
  };
  return () => ({
    get: async (key) => values.get(key),
    store: async (key, value) => {
      values.set(key, value);
      fire(key);
    },
    delete: async (key) => {
      values.delete(key);
      fire(key);
    },
    onDidChange: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const window = sharedSecrets();
const here = new ApiKeyStore(window());
const there = new ApiKeyStore(window());
let fired = 0;
here.onDidChangeElsewhere(() => fired++);

assert.equal(await here.get(), undefined);

await here.set("mine");
await settle();
assert.equal(fired, 0, "this window's own write is not news");

await there.set("theirs");
await settle();
assert.equal(fired, 1, "another window's connect reaches this one");
assert.equal(await here.get(), "theirs");

await there.delete();
await settle();
assert.equal(fired, 2, "another window's disconnect reaches this one");
assert.equal(await here.get(), undefined);

await here.delete();
await settle();
assert.equal(fired, 2, "deleting what is already gone changes nothing");

console.log("key sync: ok");
