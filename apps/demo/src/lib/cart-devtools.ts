import { EventClient } from "@tanstack/devtools-event-client"

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
    super({ pluginId: "cart-devtools" })
  }
}

export const cartDevtoolsClient = new CartDevtoolsClient()
