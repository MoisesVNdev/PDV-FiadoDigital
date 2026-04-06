/**
 * Generates a v4 UUID that works in both secure (HTTPS/localhost) and
 * insecure (plain HTTP over LAN) contexts.
 *
 * `crypto.randomUUID()` is only available in Secure Contexts (HTTPS or localhost).
 * When the app is accessed via plain HTTP on a LAN IP (e.g. 192.168.x.x),
 * `crypto.randomUUID` is `undefined`, which would throw a TypeError.
 *
 * This helper falls back to `crypto.getRandomValues()`, which IS available
 * in insecure contexts on all modern browsers.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: build a v4 UUID from crypto.getRandomValues()
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant (RFC 4122) bits
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
