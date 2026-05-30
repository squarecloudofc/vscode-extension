import { type LogOutputChannel, window } from "vscode";

let sharedChannel: LogOutputChannel | undefined;

/**
 * Routes log/info/warn/error to a shared LogOutputChannel visible in
 * View → Output → "Square Cloud". Falls back to console before the first
 * Logger is constructed (useful during very early activation).
 */
export class Logger {
  private readonly channel: LogOutputChannel;

  constructor(public readonly name: string = "Square Cloud") {
    if (!sharedChannel) {
      sharedChannel = window.createOutputChannel("Square Cloud", { log: true });
    }
    this.channel = sharedChannel;
  }

  log(message: string, ...args: unknown[]) {
    this.channel.info(`[${this.name}] ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.channel.info(`[${this.name}] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.channel.warn(`[${this.name}] ${message}`, ...args);
  }

  error(message: string, error?: unknown) {
    if (error instanceof Error) {
      this.channel.error(`[${this.name}] ${message}`, error);
    } else if (error !== undefined) {
      this.channel.error(`[${this.name}] ${message} ${String(error)}`);
    } else {
      this.channel.error(`[${this.name}] ${message}`);
    }
  }

  /** Disposes the shared channel. Call once on extension deactivate. */
  static dispose() {
    sharedChannel?.dispose();
    sharedChannel = undefined;
  }
}
