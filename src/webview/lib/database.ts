// The pure half of the database panel: how to reach a database, and what
// its settings accept. The host (src/panels/database.ts) and the webview
// share it. No imports: `node --test` loads this file.

type Engine = {
  name: string;
  scheme: string;
  user: string;
  /** MB, as the site sets it. */
  minRam: number;
};

const ENGINES: Record<string, Engine> = {
  mongo: { name: "MongoDB", scheme: "mongodb", user: "default", minRam: 1024 },
  mysql: { name: "MySQL", scheme: "mysql", user: "squarecloud", minRam: 1024 },
  postgres: {
    name: "PostgreSQL",
    scheme: "postgresql",
    user: "squarecloud",
    minRam: 1024,
  },
  redis: { name: "Redis", scheme: "rediss", user: "default", minRam: 512 },
};

/** Stands for the password in a connection URL the user copies. */
export const PASSWORD_PLACEHOLDER = "<password>";

export const engineName = (type: string) =>
  Object.hasOwn(ENGINES, type) ? ENGINES[type].name : type;

/** The engine's least memory in MB (512 for an engine not listed). */
export const minRam = (type: string) =>
  Object.hasOwn(ENGINES, type) ? ENGINES[type].minRam : 512;

/**
 * Host, user and URL, as the site builds them: every database answers at
 * `square-cloud-db-<id>.squareweb.app` on its port, over TLS.
 */
export function connection(
  type: string,
  id: string,
  port: number,
  password = PASSWORD_PLACEHOLDER,
): { host: string; user: string; url: string } {
  const engine = Object.hasOwn(ENGINES, type) ? ENGINES[type] : undefined;
  const host = `square-cloud-db-${id}.squareweb.app`;
  const user = engine?.user ?? "default";
  const scheme = engine?.scheme ?? type;
  return { host, user, url: `${scheme}://${user}:${password}@${host}:${port}` };
}

/** Letters, numbers, `_`, `-` and spaces, 1 to 32, at least one letter or number. */
export const isDatabaseName = (name: string) =>
  /^(?=.*\w)[\w\- ]{1,32}$/.test(name);

/** Why a typed memory can't be saved: not whole MB, under the engine's least, over the plan. */
export function memoryProblem(
  typed: string,
  min: number,
  max: number | null,
): "integer" | "low" | "high" | undefined {
  // Digits only: "1e3", "0x400" and "512.0" are numbers, not what the API takes.
  if (!/^\d{1,7}$/.test(typed.trim())) return "integer";
  const value = Number(typed.trim());
  if (value < min) return "low";
  if (max !== null && value > max) return "high";
  return undefined;
}
