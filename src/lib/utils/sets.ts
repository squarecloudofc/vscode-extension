export function compareSets(a: Set<any>, b: Set<any>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}
