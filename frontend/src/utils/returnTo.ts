/**
 * Only same-app relative paths are accepted as a post-solve destination, so a
 * crafted link like ?returnTo=https://evil.example can't redirect off-site.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}
