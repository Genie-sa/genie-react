import { useEffect } from 'react'
import { api } from '../api/endpoints'

export type TelemetryProperties = Record<string, string | number | boolean>

export function track(event: string, properties: TelemetryProperties): void {
  api.telemetry(event, properties).catch(() => undefined)
}

export function usePageView(page: string, properties: TelemetryProperties): void {
  useEffect(() => {
    track('page_view', { page, ...properties })
  }, [page, properties])
}
