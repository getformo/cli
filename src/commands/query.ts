import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import { stripTrailingFormatClause } from '../lib/sql'

export const query = Cli.create('query', {
  description: 'SQL analytics query commands',
})

export function queryRunRun(sql: string) {
  requireApiKey()
  const client = createClient()
  // The API wraps the query in a paginating subquery with its own
  // `FORMAT JSON`. ClickHouse forbids a `FORMAT` clause inside a subquery, so
  // strip any trailing `FORMAT`/semicolon before sending to avoid a 400.
  return client.post('/v0/query/', { query: stripTrailingFormatClause(sql) })
}

query.command('run', {
  description: 'Run a SQL query against your Formo analytics data',
  args: z.object({
    sql: z.string().describe('SQL query string to execute'),
  }),
  examples: [
    {
      args: { sql: 'SELECT count(*) FROM events' },
      description: 'Count all events',
    },
    {
      args: { sql: 'SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10' },
      description: 'Top 10 wallets by net worth',
    },
  ],
  hint: 'Requires query:read scope on your API key.',
  run({ args }) {
    return queryRunRun(args.sql)
  },
})
