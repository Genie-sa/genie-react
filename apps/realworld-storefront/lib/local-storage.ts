export function readStringList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
  } catch {
    return []
  }
}
