import {
  type HostMessage,
  type RpcErrorBody,
  SIGNED_OUT,
  type ViewMessage,
} from "./protocol";

type VsCodeApi = {
  postMessage(message: ViewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare function acquireVsCodeApi(): VsCodeApi;

// VS Code allows one call per page load.
const vscode = acquireVsCodeApi();

/** A host handler's failure, with the API's status and code when there is one. */
export class RpcError extends Error {
  readonly status: number;
  readonly code: string;

  constructor({ status, code, message }: RpcErrorBody) {
    super(message);
    this.name = "RpcError";
    this.status = status;
    this.code = code;
  }
}

/**
 * A key connected before 6.0 lacks the newer scopes (`files:*`, `blob:*`,
 * `mcp`): such a tab offers "Reconnect", never the raw error.
 */
export const needsReconnect = (error: unknown) =>
  error instanceof RpcError &&
  error.status === 403 &&
  error.code === "MISSING_SCOPE";

/** No key is stored: the panel offers "Connect account" instead. */
export const isSignedOut = (error: unknown) =>
  error instanceof RpcError && error.code === SIGNED_OUT;

let nextId = 0;
const pending = new Map<
  number,
  { resolve(value: unknown): void; reject(error: RpcError): void }
>();
const listeners = new Set<(message: HostMessage) => void>();

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  if (message?.type === "rpc-result") {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new RpcError(message.error));
    else call.resolve(message.result);
    return;
  }
  for (const listener of listeners) listener(message);
});

export function post(message: ViewMessage): void {
  vscode.postMessage(message);
}

/** Runs `method` on the host; rejects with an `RpcError`. */
export function call<T>(method: string, params?: unknown): Promise<T> {
  const id = ++nextId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    post({ type: "rpc", id, method, params });
  });
}

/** Every host message except RPC results. Returns the unsubscribe. */
export function onHostMessage(
  listener: (message: HostMessage) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What survives a reload of this webview (and feeds the panel serializer). */
export function persisted<T extends object>(): Partial<T> {
  const state = vscode.getState();
  return typeof state === "object" && state !== null ? (state as T) : {};
}

/** Merges `patch` into the persisted state. */
export function persist(patch: object): void {
  vscode.setState({ ...persisted(), ...patch });
}
