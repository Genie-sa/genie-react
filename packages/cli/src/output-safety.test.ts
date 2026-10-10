import { describe, expect, it } from 'vitest'
import { formatOutputFailureDiagnostic, setOutputContext } from './output-safety'

describe('stdout failure diagnostics', () => {
  it('preserves the completed operation and capture ID for ENOSPC recovery', () => {
    setOutputContext({ operation: 'capture export', operationId: 'cap_123' })
    expect(
      JSON.parse(
        formatOutputFailureDiagnostic(Object.assign(new Error('full'), { code: 'ENOSPC' })),
      ),
    ).toMatchObject({
      schemaVersion: '2.0',
      status: 'error',
      reason: 'output_failure',
      userActionRequired: true,
      code: 'ENOSPC',
      operation: 'capture export',
      operationId: 'cap_123',
    })
  })
})
