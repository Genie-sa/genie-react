import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Density = 'comfortable' | 'compact'

export interface RecentItem {
  id: string
  label: string
  kind: 'order' | 'customer'
}

const MAX_RECENT = 5

interface WorkspaceState {
  density: Density
  hiddenColumns: string[]
  recentlyViewed: RecentItem[]
  selectedOrderIds: ReadonlySet<string>
  setDensity: (density: Density) => void
  toggleColumn: (column: string) => void
  pushRecent: (item: RecentItem) => void
  toggleOrderSelection: (id: string) => void
  setOrderSelection: (ids: Iterable<string>) => void
  clearOrderSelection: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      density: 'comfortable',
      hiddenColumns: [],
      recentlyViewed: [],
      selectedOrderIds: new Set<string>(),
      setDensity: (density) => set({ density }),
      toggleColumn: (column) => {
        const hidden = get().hiddenColumns
        set({
          hiddenColumns: hidden.includes(column)
            ? hidden.filter((entry) => entry !== column)
            : [...hidden, column],
        })
      },
      pushRecent: (item) => {
        const current = get().recentlyViewed
        if (current[0]?.id === item.id) return
        set({
          recentlyViewed: [item, ...current.filter((entry) => entry.id !== item.id)].slice(
            0,
            MAX_RECENT,
          ),
        })
      },
      toggleOrderSelection: (id) => {
        const next = new Set(get().selectedOrderIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        set({ selectedOrderIds: next })
      },
      setOrderSelection: (ids) => set({ selectedOrderIds: new Set(ids) }),
      clearOrderSelection: () => set({ selectedOrderIds: new Set<string>() }),
    }),
    {
      name: 'meridian.workspace',
      partialize: ({ density, hiddenColumns, recentlyViewed }) => ({
        density,
        hiddenColumns,
        recentlyViewed,
      }),
    },
  ),
)
