import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios'
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
      .map(
        ([key, value]) =>
          `${key}: ${
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value)
          }`,
      )
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

/**
 * The response interceptor below unwraps every response to its body
 * (`res.data`), so the raw AxiosInstance types would lie — they promise
 * `AxiosResponse<T>` while the runtime value is the body itself. This
 * interface states what actually comes back.
 */
export interface FormoClient {
  get(url: string, config?: AxiosRequestConfig): Promise<unknown>
  post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
  put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
  patch(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
  delete(url: string, config?: AxiosRequestConfig): Promise<unknown>
  request(config: AxiosRequestConfig): Promise<unknown>
  defaults: AxiosInstance['defaults']
}

function createClient(options: ClientOptions = {}): FormoClient {
  const apiKey = options.apiKey ?? getApiKey()
  const baseURL = options.baseURL ?? getApiBaseUrl()

  // Fail here, not with a server-side 401: every authenticated command needs
  // a key, and this guard catches call sites that forget requireApiKey().
  if (!apiKey) {
    throw new Error(
      'No API key configured. Run `formo login <apiKey>` or set FORMO_API_KEY env var.',
    )
  }

  const instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  })

  instance.interceptors.response.use(
    (res) => res.data,
    (error: AxiosError) => {
      throw parseApiError(error)
    },
  )

  // The interceptor changes what the promise resolves to; the cast makes the
  // public type match the runtime behavior (see FormoClient above).
  return instance as unknown as FormoClient
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
