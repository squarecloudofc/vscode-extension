import { disposeAllRealtimeSessions } from "@/commands/applications/tools/realtime";
import { disposeAllChannels } from "@/lib/utils/output-channels";

/**
 * VSCode calls dispose on every entry pushed into `context.subscriptions`
 * before invoking deactivate(), so SquareCloudExtension.dispose() already ran
 * by the time we get here. This hook only takes care of process-global state
 * the disposable graph can't reach.
 */
export function deactivate(): void {
  disposeAllRealtimeSessions();
  disposeAllChannels();
}
