// input: 1 or 1.2 or 1.2.3, output respectively 1.0.0, 1.2.0, 1.2.3
export const completeVersion = (maybeIncompleteVersion: string): string => {
  const dotCount = (maybeIncompleteVersion.match(/\./g) || []).length
  if (dotCount === 0) return `${maybeIncompleteVersion}.0.0`
  else if (dotCount === 1) return `${maybeIncompleteVersion}.0`

  return maybeIncompleteVersion
}
