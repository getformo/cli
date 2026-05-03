import axios, { AxiosError } from 'axios'
import { getApiKey } from './config'

const BASE_URL = 'https://api.formo.so'

function createClient() {
  const apiKey = getApiKey()
  const baseURL = BASE_URL

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
      const status = error.response?.status
      const body = error.response?.data as
        | {
            error?: {
              code?: string
              message?: string
              doc_url?: string
              param?: string
              details?: Record<string, unknown>
            }
          }
        | undefined
      const apiError = body?.error
      const baseMessage = apiError?.message ?? error.message
      const parts: string[] = []
      parts.push(apiError?.code ? `[${apiError.code}] ${baseMessage}` : baseMessage)
      if (apiError?.param) parts.push(`Param: ${apiError.param}`)
      if (apiError?.doc_url) parts.push(`Docs:  ${apiError.doc_url}`)
      const message = parts.join('\n   ')
      throw Object.assign(new Error(message), {
        status,
        code: apiError?.code,
        docUrl: apiError?.doc_url,
        param: apiError?.param,
        details: apiError?.details,
        transportCode: error.code,
      })
    },
  )

  return instance
}

export function requireApiKey(): void {
  if (!getApiKey()) {
    throw new Error(
      'No API key configured. Run `formo login <apiKey>` or set FORMO_API_KEY env var.',
    )
  }
}

export { createClient }
