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
      const data = error.response?.data as
        | { message?: string; error?: string | { message?: string; code?: string } }
        | undefined
      const errorField = data?.error
      const message =
        data?.message ??
        (typeof errorField === 'object' ? errorField?.message : errorField) ??
        error.message
      throw Object.assign(new Error(message), { status, code: error.code })
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
