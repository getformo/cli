import { getApiKey } from './config'

const API_BASE_URL = 'https://api.formo.so'

export async function forwardToFormo(req: Request): Promise<Response> {
  const apiKey = getApiKey()
  const incoming = new URL(req.url)
  const upstream = new URL(incoming.pathname + incoming.search, API_BASE_URL)

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('content-length')
  if (apiKey) headers.set('authorization', `Bearer ${apiKey}`)
  if (!headers.has('content-type') && req.method !== 'GET' && req.method !== 'HEAD') {
    headers.set('content-type', 'application/json')
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'follow',
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }

  return fetch(upstream, init)
}
