import { type Disposable, type OutputChannel, window } from "vscode";

interface ChannelOptions {
  /** Pass `true` for ANSI-capable channels (e.g. coloured app logs). */
  ansi?: boolean;
}

const channels = new Map<string, OutputChannel>();

/**
 * Returns (or lazily creates) a named OutputChannel and registers it on the
 * caller-provided disposable bag so it dies with the extension.
 *
 * Keys should be deterministic per logical channel (e.g. `logs:${appId}`).
 */
export function getOutputChannel(
  bag: { push(...items: Disposable[]): unknown },
  key: string,
  name: string,
  options: ChannelOptions = {},
): OutputChannel {
  const existing = channels.get(key);
  if (existing) return existing;

  const channel = options.ansi
    ? window.createOutputChannel(name, "ansi")
    : window.createOutputChannel(name);

  channels.set(key, channel);
  bag.push({
    dispose() {
      channels.delete(key);
      channel.dispose();
    },
  });
  return channel;
}

/** Disposes every tracked channel. Call once on full extension shutdown. */
export function disposeAllChannels(): void {
  for (const channel of channels.values()) channel.dispose();
  channels.clear();
}
