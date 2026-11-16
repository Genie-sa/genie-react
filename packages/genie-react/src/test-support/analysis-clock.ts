import { vi } from 'vitest'

/** Stops `performance.now`, so a stall on a loaded machine cannot run a commit past the analysis time limit; only the fiber and operation limits then decide coverage. */
export function freezeAnalysisClock(): void {
  vi.spyOn(performance, 'now').mockReturnValue(0)
}
