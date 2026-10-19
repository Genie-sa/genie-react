// Written as a literal `process.env.NODE_ENV` so client bundlers statically replace it; the catch covers runtimes with no `process` global (unbundled dev pages).
export function isProductionBuild(): boolean {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}
