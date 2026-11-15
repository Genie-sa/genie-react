import { EventClient } from "@tanstack/devtools-event-client"
import { BUS_RECONNECT_MS } from "./devtools-bus"

export interface CartItem {
  id: string
  name: string
  price: number
}

interface CartEventMap {
  "cart-updated": { items: Array<CartItem>; total: number }
}

class CartDevtoolsClient extends EventClient<CartEventMap> {
  constructor() {
    super({ pluginId: "cart-devtools", reconnectEveryMs: BUS_RECONNECT_MS })
  }
}

export const cartDevtoolsClient = new CartDevtoolsClient()
