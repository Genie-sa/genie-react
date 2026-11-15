let excludedRefreshCommits = 0

/** Monotonic count of Fast Refresh commits Genie excluded from analysis; readers diff it against their own baseline. */
export function countExcludedRefreshCommit(): void {
  excludedRefreshCommits += 1
}

export function getExcludedRefreshCommitTotal(): number {
  return excludedRefreshCommits
}
