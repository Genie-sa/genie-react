import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import { referenceDataOptions } from '../../app/query-client'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  trend: (days: number) => [...dashboardKeys.all, 'orders-trend', days] as const,
  regions: () => [...dashboardKeys.all, 'revenue-by-region'] as const,
  statuses: () => [...dashboardKeys.all, 'status-breakdown'] as const,
  carriers: () => [...dashboardKeys.all, 'carriers'] as const,
  stock: () => [...dashboardKeys.all, 'stock-summary'] as const,
}

export const dashboardSummaryQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: ({ signal }) => api.dashboardSummary(signal),
  })

export const ordersTrendQuery = (days: number) =>
  queryOptions({
    queryKey: dashboardKeys.trend(days),
    queryFn: ({ signal }) => api.ordersTrend(days, signal),
  })

export const revenueByRegionQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.regions(),
    queryFn: ({ signal }) => api.revenueByRegion(signal),
  })

export const statusBreakdownQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.statuses(),
    queryFn: ({ signal }) => api.statusBreakdown(signal),
  })

export const carrierPerformanceQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.carriers(),
    queryFn: ({ signal }) => api.carrierPerformance(signal),
  })

export const stockSummaryQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.stock(),
    queryFn: ({ signal }) => api.stockSummary(signal),
    ...referenceDataOptions,
  })
