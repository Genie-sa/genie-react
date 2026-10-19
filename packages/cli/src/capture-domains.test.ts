import { CAPTURE_DOMAINS as PROTOCOL_CAPTURE_DOMAINS } from 'genie-react/protocol'
import { expect, it } from 'vitest'
import { CAPTURE_DOMAINS } from './capture-domains'

it('lists exactly the capture domains the protocol accepts', () => {
  expect(CAPTURE_DOMAINS).toEqual(PROTOCOL_CAPTURE_DOMAINS)
})
