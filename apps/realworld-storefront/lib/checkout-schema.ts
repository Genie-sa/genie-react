import { z } from 'zod'

export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'NO', name: 'Norway' },
  { code: 'IS', name: 'Iceland' },
] as const

const countryCodes = COUNTRIES.map((country) => country.code) as [string, ...string[]]

export const contactSchema = z.object({
  email: z.email('Enter a valid email address'),
  fullName: z.string().trim().min(2, 'Enter your full name'),
  street: z.string().trim().min(3, 'Enter a street address'),
  city: z.string().trim().min(2, 'Enter a city'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid postal code'),
  country: z.enum(countryCodes, 'Choose a country'),
})

export const deliverySchema = z.object({
  shippingMethod: z.enum(['standard', 'express', 'pickup'], 'Choose a delivery option'),
  instructions: z.string().max(200, 'Keep instructions under 200 characters'),
})

export const paymentSchema = z.object({
  cardName: z.string().trim().min(2, 'Enter the name on the card'),
  cardNumber: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{16}$/, 'Card numbers have 16 digits')),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY'),
  cvc: z.string().regex(/^\d{3,4}$/, 'Enter the 3 or 4 digit code'),
})

export const orderSchema = contactSchema.extend(deliverySchema.shape).extend(paymentSchema.shape)

export type ContactValues = z.input<typeof contactSchema>
export type DeliveryValues = z.input<typeof deliverySchema>
export type PaymentValues = z.input<typeof paymentSchema>
export type CheckoutValues = ContactValues & DeliveryValues & PaymentValues

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const errors: FieldErrors<T> = {}
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined
    if (key !== undefined && errors[key] === undefined) errors[key] = issue.message
  }
  return errors
}
