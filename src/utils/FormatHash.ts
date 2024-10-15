export function FormatHash(hash: string) {
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}
