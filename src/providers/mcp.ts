import {
  type Disposable,
  EventEmitter,
  lm,
  McpHttpServerDefinition,
  type McpServerDefinitionProvider,
  Uri,
} from "vscode";

import type { ApiKey } from "@/lib/api-key";

/** The id in package.json's `mcpServerDefinitionProviders`. */
const PROVIDER_ID = "squarecloud.mcp";
/** Square Cloud's MCP server answers only here. */
const MCP_URL = "https://mcp.squarecloud.app/mcp";

/**
 * Square Cloud's tools in agent mode: one HTTP MCP server, authorized by
 * the stored key, offered only when that key has the `mcp` scope (one from
 * 5.x or a pasted one doesn't; the sidebar offers to reconnect instead).
 * VS Code may keep the provided definitions, so they carry no key: it goes
 * into the request header only when VS Code starts the server (resolve).
 * Every sign-in, sign-out and key change calls `refresh()` (sidebar sync).
 */
export class SquareCloudMcp
  implements McpServerDefinitionProvider<McpHttpServerDefinition>, Disposable
{
  private readonly changed = new EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this.changed.event;
  private readonly registration?: Disposable;

  constructor(private readonly apiKey: ApiKey) {
    // An editor built on an older VS Code may lack the API: then no tools.
    if (typeof lm?.registerMcpServerDefinitionProvider === "function")
      this.registration = lm.registerMcpServerDefinitionProvider(
        PROVIDER_ID,
        this,
      );
  }

  /** Whether the stored key may use the MCP server. */
  async ready(): Promise<boolean> {
    const [key, account] = await Promise.all([
      this.apiKey.get(),
      this.apiKey.getAccount(),
    ]);
    return Boolean(key && account?.scopes?.includes("mcp"));
  }

  /** The key appeared, changed or went away: VS Code asks again. */
  refresh(): void {
    this.changed.fire();
  }

  async provideMcpServerDefinitions(): Promise<McpHttpServerDefinition[]> {
    if (!(await this.ready())) return [];
    return [new McpHttpServerDefinition("Square Cloud", Uri.parse(MCP_URL))];
  }

  /** Signed out (or the scope went away) since: the server doesn't start. */
  async resolveMcpServerDefinition(
    server: McpHttpServerDefinition,
  ): Promise<McpHttpServerDefinition | undefined> {
    const key = await this.apiKey.get();
    if (!key || !(await this.ready())) return undefined;
    server.headers = { ...server.headers, Authorization: key };
    return server;
  }

  dispose(): void {
    this.registration?.dispose();
    this.changed.dispose();
  }
}
