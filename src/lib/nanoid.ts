// Lightweight unique id generator (no external dependency).
// Uses crypto.randomUUID when available, falls back to Math.random.
export function nanoid(size = 10): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, size);
  }
  return Math.random().toString(36).slice(2, 2 + size);
}
