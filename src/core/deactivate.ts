import { stopAllStreams } from "@/panels/app";

/**
 * VSCode calls dispose on every entry pushed into `context.subscriptions`
 * before invoking deactivate(), so SquareCloudExtension.dispose() already ran
 * by the time we get here. This hook only takes care of process-global state
 * the disposable graph can't reach.
 */
export function deactivate(): void {
  stopAllStreams();
}
