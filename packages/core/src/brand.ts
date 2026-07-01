declare const brand: unique symbol

/**
 * Nominal ("opaque") brand. `Brand<number, 'NodeId'>` is assignable *to* `number`, but a plain
 * `number` is not assignable *to* it — so two id families that are both numbers at runtime can't be
 * passed in each other's place by mistake. The phantom key lives only in the type system: branded
 * values are plain numbers/strings at runtime, so they serialize over the wire and index into
 * records unchanged. Mirrors TanStack's phantom-symbol brands (Query's `DataTag`, Router's
 * `SearchSchemaInput`).
 */
export type Brand<T, K extends string> = T & { readonly [brand]: K }
