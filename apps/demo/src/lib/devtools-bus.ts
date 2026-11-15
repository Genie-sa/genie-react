/** TanStack Devtools starts its event bus after a lazy import, while an EventClient gives up after five connect attempts and then drops every event for the page's lifetime. Attempts this far apart let a plugin that emits on mount outlast a bus that loads up to about eight seconds late. */
export const BUS_RECONNECT_MS = 2000
