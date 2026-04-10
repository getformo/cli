import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const profiles = Cli.create('profiles', {
  description: 'Wallet profile commands',
})

export function getProfileRun(address: string, expand?: string) {
  requireApiKey()
  const client = createClient()
  const params: Record<string, string> = {}
  if (expand) params.expand = expand
  return client.get(`/v0/profiles/${encodeURIComponent(address)}`, { params })
}

profiles.command('get', {
  description: 'Get a wallet profile by address',
  args: z.object({
    address: z.string().describe('Wallet address (0x... or ENS name)'),
  }),
  options: z.object({
    expand: z
      .string()
      .optional()
      .describe('Comma-separated list of fields to expand: apps,chains,tokens,labels'),
  }),
  examples: [
    { args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }, description: 'Get a wallet profile' },
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { expand: 'labels,chains' },
      description: 'Get profile with expanded labels and chains',
    },
  ],
  run({ args, options }) {
    return getProfileRun(args.address, options.expand)
  },
})

export interface SearchProfilesOptions {
  address?: string
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: string
  expand?: string
  conditions?: string
  logic?: 'and' | 'or'
}

export function searchProfilesRun(options: SearchProfilesOptions) {
  requireApiKey()
  const client = createClient()

  const params: Record<string, string | number> = {}
  if (options.address) params.address = options.address
  if (options.limit !== undefined) params.limit = options.limit
  if (options.offset !== undefined) params.offset = options.offset
  if (options.orderBy) params.order_by = options.orderBy
  if (options.orderDir) params.order_dir = options.orderDir
  if (options.expand) params.expand = options.expand

  let body: object | undefined
  if (options.conditions) {
    try {
      const conditions = JSON.parse(options.conditions)
      if (!Array.isArray(conditions)) throw new Error('not an array')
      body = { conditions, logic: options.logic ?? 'and' }
    } catch {
      throw new Error('--conditions must be valid JSON array of FilterCondition objects')
    }
  }

  return client.request({ method: 'get', url: '/v0/profiles/', params, data: body })
}

profiles.command('search', {
  description: 'Search wallet profiles with optional filters',
  options: z.object({
    address: z.string().optional().describe('Filter by wallet address'),
    limit: z.coerce.number().optional().describe('Max results to return'),
    offset: z.coerce.number().optional().describe('Pagination offset'),
    orderBy: z
      .enum([
        'last_onchain',
        'first_onchain',
        'net_worth_usd',
        'updated_at',
        'tx_count',
        'first_seen',
        'last_seen',
        'num_sessions',
        'revenue',
        'volume',
        'points',
      ])
      .optional()
      .describe('Field to sort by'),
    orderDir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
    expand: z.string().optional().describe('Comma-separated fields to expand'),
    conditions: z
      .string()
      .optional()
      .describe('JSON array of FilterCondition objects for advanced filtering'),
    logic: z
      .enum(['and', 'or'])
      .optional()
      .describe('Logic operator for combining conditions: "and" (default) or "or"'),
  }),
  examples: [
    { options: { limit: 10 }, description: 'List first 10 profiles' },
    {
      options: { orderBy: 'net_worth_usd', orderDir: 'desc', limit: 5 },
      description: 'Top 5 profiles by net worth',
    },
    {
      options: {
        conditions: '[{"field":"net_worth_usd","op":"gt","value":10000}]',
        limit: 20,
      },
      description: 'Search profiles with net worth > 10000',
    },
    {
      options: {
        conditions: '[{"field":"net_worth_usd","op":"gt","value":10000},{"field":"tx_count","op":"gt","value":50}]',
        logic: 'or',
        limit: 20,
      },
      description: 'Search profiles matching either condition',
    },
  ],
  run({ args: _args, options }) {
    return searchProfilesRun(options)
  },
})
