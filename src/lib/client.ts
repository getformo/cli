import axios, { AxiosError } from 'axios'
import { getApiKey } from './config'

export const DEFAULT_API_BASE_URL = 'https://api.formo.so'
export const DEFAULT_EVENTS_BASE_URL = 'https://events.formo.so'

export function getApiBaseUrl() {
  return process.env.FORMO_API_BASE_URL ?? DEFAULT_API_BASE_URL
}

export function getEventsBaseUrl() {
  return process.env.FORMO_EVENTS_BASE_URL ?? DEFAULT_EVENTS_BASE_URL
}

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    doc_url?: string
    param?: string
    details?: Record<string, unknown>
  }
}

export interface DecoratedApiError extends Error {
  status?: number
  code?: string
  docUrl?: string
  param?: string
  details?: Record<string, unknown>
  transportCode?: string
}

/**
 * Translate an AxiosError into a thrown Error with the API's structured
 * `{ error: { code, message, doc_url, param, details } }` envelope decoded
 * onto the Error instance and into a multi-line, human-readable `.message`.
 *
 * Exported for unit testing — used by the response interceptor below.
 */
export function parseApiError(error: AxiosError): DecoratedApiError {
  const status = error.response?.status
  const body = error.response?.data as ApiErrorBody | undefined
  const apiError = body?.error
  const baseMessage = apiError?.message ?? error.message
  const parts: string[] = []
  parts.push(apiError?.code ? `[${apiError.code}] ${baseMessage}` : baseMessage)
  if (apiError?.param) parts.push(`Param: ${apiError.param}`)
  if (apiError?.details && Object.keys(apiError.details).length > 0) {
    const details = Object.entries(apiError.details)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('; ')
    parts.push(`Details: ${details}`)
  }
  if (apiError?.doc_url) parts.push(`Docs:  ${apiError.doc_url}`)
  const message = parts.join('\n   ')
  return Object.assign(new Error(message), {
    status,
    code: apiError?.code,
    docUrl: apiError?.doc_url,
    param: apiError?.param,
    details: apiError?.details,
    transportCode: error.code,
  })
}

export interface ClientOptions {
  baseURL?: string
  apiKey?: string
}

function createClient(options: ClientOptions = {}) {
  const apiKey = options.apiKey ?? getApiKey()
  const baseURL = options.baseURL ?? getApiBaseUrl()

  const instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  })

  instance.interceptors.response.use(
    (res) => res.data,
    (error: AxiosError) => {
      throw parseApiError(error)
    },
  )

  return instance
}

export function createEventsClient(writeKey: string) {
  if (!writeKey) {
    throw new Error(
      'No event write key configured. Pass --write-key or set FORMO_WRITE_KEY.',
    )
  }
  return createClient({ baseURL: getEventsBaseUrl(), apiKey: writeKey })
}

export function requireApiKey(): void {
  if (!getApiKey()) {
    throw new Error(
      'No API key configured. Run `formo login <apiKey>` or set FORMO_API_KEY env var.',
    )
  }
}

export { createClient }
