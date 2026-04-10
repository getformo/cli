import { createClient, requireApiKey } from '../lib/client'

export function queryRunRun(sql: string) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/query/', { query: sql })
}
