/** Collision-safe IDs for client-side entities (replaces Date.now()). */
export function newId(prefix?: string): string {
  const u =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  return prefix ? `${prefix}_${u}` : u
}
