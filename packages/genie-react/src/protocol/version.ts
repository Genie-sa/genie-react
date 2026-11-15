declare const __GENIE_REACT_VERSION__: string | undefined

/** The genie-react release this code was built from; the build injects it, and unbundled sources report a `-source` placeholder. */
export const GENIE_REACT_VERSION: string =
  typeof __GENIE_REACT_VERSION__ === 'string' ? __GENIE_REACT_VERSION__ : '0.0.0-source'

/** `major.minor`, the unit of compatibility: before 1.0 a minor release may break the wire contract. */
export function releaseLine(version: string): string | null {
  const match = /^(\d+)\.(\d+)\.\d+(?:[-+].*)?$/.exec(version)
  return match ? `${match[1]}.${match[2]}` : null
}

/** Two Genie packages interoperate only within one release line; an unparseable version is never assumed compatible. */
export function sameReleaseLine(left: string, right: string): boolean {
  const line = releaseLine(left)
  return line !== null && line === releaseLine(right)
}
