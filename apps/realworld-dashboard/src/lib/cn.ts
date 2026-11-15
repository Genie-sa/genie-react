import { type ClassValue, clsx } from 'clsx'

export function cn(...values: ClassValue[]): string {
  return clsx(values)
}
