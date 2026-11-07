/** Tiny classnames helper. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
