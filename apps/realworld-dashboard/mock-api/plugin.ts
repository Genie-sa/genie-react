import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { z } from 'zod'
import type { BackendState, FaultRule, LatencyRule } from '../src/api/types.ts'
import { createDatabase, DEFAULT_SEED } from './db.ts'
import {
  delay,
  HttpError,
  matchesPath,
  type RequestContext,
  readJsonBody,
  sendError,
  sendJson,
} from './http.ts'
import { type ApiState, createRoutes } from './routes.ts'

const API_PREFIX = '/api/'
const DEV_PREFIX = '/api/__dev/'

const faultSchema = z.object({
  method: z.string().toUpperCase().optional(),
  path: z.string().startsWith('/api/'),
  status: z.number().int().min(400).max(599),
  message: z.string().max(200).optional(),
  times: z.number().int().min(1).optional(),
})
const latencySchema = z.object({
  rules: z
    .array(
      z.object({
        method: z.string().toUpperCase().optional(),
        path: z.string().startsWith('/api/'),
        ms: z.number().int().min(0).max(30_000),
      }),
    )
    .default([]),
  scale: z.number().min(0).max(20).default(1),
})
const resetSchema = z.object({ seed: z.number().int().optional() }).default({})

interface ActiveFault extends FaultRule {
  remaining: number | null
}

interface MockServer {
  state: ApiState
  seed: number
  faults: ActiveFault[]
  latency: LatencyRule[]
  latencyScale: number
  requestCount: number
}

function ruleMatches(
  rule: { method?: string; path: string },
  method: string,
  path: string,
): boolean {
  return (!rule.method || rule.method === method) && matchesPath(rule.path, path)
}

function snapshot(server: MockServer): BackendState {
  return {
    seed: server.seed,
    faults: server.faults.map((fault) => ({ ...fault })),
    latency: server.latency.map((rule) => ({ ...rule })),
    latencyScale: server.latencyScale,
    requestCount: server.requestCount,
    counts: {
      orders: server.state.db.orders.length,
      customers: server.state.db.customers.length,
      products: server.state.db.products.length,
    },
  }
}

function handleDevRequest(
  server: MockServer,
  method: string,
  path: string,
  body: unknown,
): unknown {
  const action = `${method} ${path.slice(DEV_PREFIX.length)}`
  switch (action) {
    case 'GET state':
      return snapshot(server)
    case 'POST reset': {
      const { seed } = resetSchema.parse(body ?? {})
      server.seed = seed ?? DEFAULT_SEED
      server.state.db = createDatabase(server.seed)
      server.state.telemetryEvents = 0
      server.faults = []
      server.latency = []
      server.latencyScale = 1
      server.requestCount = 0
      return snapshot(server)
    }
    case 'PUT faults': {
      const faults = z.array(faultSchema).max(20).parse(body)
      server.faults = faults.map((fault) => ({ ...fault, remaining: fault.times ?? null }))
      return snapshot(server)
    }
    case 'PUT latency': {
      const { rules, scale } = latencySchema.parse(body ?? {})
      server.latency = rules
      server.latencyScale = scale
      return snapshot(server)
    }
    default:
      throw new HttpError(404, 'not_found', `No dev endpoint for ${action}`)
  }
}

function createMiddleware(): Connect.NextHandleFunction {
  const server: MockServer = {
    state: { db: createDatabase(DEFAULT_SEED), telemetryEvents: 0 },
    seed: DEFAULT_SEED,
    faults: [],
    latency: [],
    latencyScale: 1,
    requestCount: 0,
  }
  const routes = createRoutes(server.state)

  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(API_PREFIX)) {
      next()
      return
    }
    const method = (request.method ?? 'GET').toUpperCase()
    const path = url.pathname
    void (async () => {
      try {
        const body = await readJsonBody(request)
        if (path.startsWith(DEV_PREFIX)) {
          sendJson(response, 200, handleDevRequest(server, method, path, body))
          return
        }
        server.requestCount++
        const route = routes.find((entry) => entry.method === method && entry.matcher.test(path))
        if (!route) throw new HttpError(404, 'not_found', `No route for ${method} ${path}`)
        const match = route.matcher.exec(path)
        const params = Object.fromEntries(
          route.keys.map((key, index) => [key, decodeURIComponent(match?.[index + 1] ?? '')]),
        )
        const token = (request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
        const context: RequestContext = {
          method,
          path,
          params,
          query: url.searchParams,
          body,
          userId: token.startsWith('tok-') ? token.slice(4) : null,
        }
        const override = server.latency.find((rule) => ruleMatches(rule, method, path))
        const baseLatency =
          override?.ms ??
          (typeof route.latencyMs === 'function' ? route.latencyMs(context) : route.latencyMs)
        await delay(Math.round(baseLatency * server.latencyScale))
        const fault = server.faults.find(
          (rule) => ruleMatches(rule, method, path) && rule.remaining !== 0,
        )
        if (fault) {
          if (fault.remaining !== null) fault.remaining--
          throw new HttpError(
            fault.status,
            'injected_fault',
            fault.message ?? `Injected ${fault.status} for ${method} ${path}`,
          )
        }
        if (!route.public && context.userId === null)
          throw new HttpError(401, 'unauthenticated', 'Sign in to continue')
        sendJson(response, 200, route.handler(context))
      } catch (error) {
        if (error instanceof HttpError) sendError(response, error.status, error.code, error.message)
        else if (error instanceof z.ZodError)
          sendError(response, 422, 'validation_failed', error.issues[0]?.message ?? 'Invalid body')
        else
          sendError(
            response,
            500,
            'internal',
            error instanceof Error ? error.message : 'Unexpected error',
          )
      }
    })()
  }
}

export function mockApi(): Plugin {
  return {
    name: 'meridian-mock-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware())
    },
  }
}
