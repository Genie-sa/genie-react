type Element = object

export declare const version: string
export declare function createElement(type: unknown, props?: object | null, ...children: unknown[]): Element
export declare function lazy(load: () => Promise<{ default: (props: object) => unknown }>): Element
export declare const Suspense: Element
export declare function use<T>(usable: Promise<T>): T
export declare function createRoot(container: Element): {
  render(element: Element): void
  unmount(): void
}
