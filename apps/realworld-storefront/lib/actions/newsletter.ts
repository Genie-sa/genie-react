'use server'

import { z } from 'zod'
import { storeState } from '../data/state'

export interface NewsletterState {
  status: 'idle' | 'subscribed' | 'invalid'
  message: string
}

const emailSchema = z.email()

export async function subscribe(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim())
  if (!parsed.success) return { status: 'invalid', message: 'Enter a valid email address.' }
  storeState().subscribers.add(parsed.data)
  return { status: 'subscribed', message: `We will write to ${parsed.data} once a month.` }
}
