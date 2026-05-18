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
  hint: 'Requires profiles:read scope on your API key.',
  run({ args, options }) {
    return getProfileRun(args.address, options.expand)
  },
})

export interface SearchProfilesOptions {
  address?: string
  page?: number
  size?: number
  orderBy?: string
  orderDir?: string
  expand?: string
  conditions?: string
  logic?: 'and' | 'or'
}

// Accepted first segments for a FilterCondition `field`, mirroring the API's
// parseField(). A field whose prefix is not one of these is silently ignored
// server-side (no error, no filtering — the search returns everything), so we
// reject it client-side with an actionable message instead.
const CONDITION_FIELD_PREFIXES = new Set([
  'user',
  'users',
  'chain',
  'chains',
  'app',
  'apps',
  'token',
  'tokens',
  'label',
  'labels',
])

/**
 * Parse and validate the --conditions JSON. Ensures it is an array of
 * `{ field, op, value }` objects whose `field` is a typed path (e.g.
 * `users.net_worth_usd`) — a bare name like `net_worth_usd` is silently
 * dropped by the API, so it is rejected here. Exported for unit testing.
 */
export function parseSearchConditions(raw: string): unknown[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('--conditions must be a valid JSON array of FilterCondition objects')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('--conditions must be a valid JSON array of FilterCondition objects')
  }
  for (const cond of parsed) {
    if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
      throw new Error('--conditions: each entry must be an object with field, op, value')
    }
    const field = (cond as { field?: unknown }).field
    if (typeof field !== 'string' || field.length === 0) {
      throw new Error('--conditions: each entry must have a non-empty string "field"')
    }
    if (!field.includes('.') || !CONDITION_FIELD_PREFIXES.has(field.split('.')[0])) {
      throw new Error(
        `--conditions: field "${field}" must be a typed path — prefix it with ` +
          'users., chains., apps., tokens., or labels. ' +
          '(a bare name is silently ignored by the API and returns the entire unfiltered dataset)',
      )
    }
  }
  return parsed
}

export function searchProfilesRun(options: SearchProfilesOptions) {
  requireApiKey()
  const client = createClient()

  const params: Record<string, string | number> = {}
  if (options.address) params.address = options.address
  if (options.page !== undefined) params.page = options.page
  if (options.size !== undefined) params.size = options.size
  if (options.orderBy) params.order_by = options.orderBy
  if (options.orderDir) params.order_dir = options.orderDir
  if (options.expand) params.expand = options.expand

  let body: object | undefined
  if (options.conditions) {
    body = {
      conditions: parseSearchConditions(options.conditions),
      logic: options.logic ?? 'and',
    }
  }

  return client.request({ method: 'get', url: '/v0/profiles/', params, data: body })
}

profiles.command('search', {
  description: 'Search wallet profiles with optional filters',
  options: z.object({
    address: z.string().optional().describe('Filter by wallet address'),
    page: z.coerce.number().optional().describe('Page number (1-indexed, default 1)'),
    size: z.coerce.number().optional().describe('Page size (default 100, max 1000)'),
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
      .describe(
        'JSON array of FilterCondition objects: [{"field","op","value"}]. ' +
          'The "field" MUST be a typed path — a bare name like "net_worth_usd" is silently ignored. ' +
          'Profile: users.net_worth_usd, users.volume, users.revenue, users.points. ' +
          'Engagement: users.device, users.browser, users.os, users.location, users.lifecycle. ' +
          'Socials: users.ens, users.farcaster, users.lens, etc. ' +
          'Chains: chains.balance or chains.{chain_id}.balance. ' +
          'Apps: apps.{app_id}.balance. Tokens: tokens.{address}.balance ' +
          '(optional "scope":"any"|"protocol" + "appId"). Labels: labels.{tag_id}. ' +
          'op: eq, neq, gt, gte, lt, lte, in, nin.',
      ),
    logic: z
      .enum(['and', 'or'])
      .optional()
      .describe('Logic operator for combining conditions: "and" (default) or "or"'),
  }),
  examples: [
    { options: { size: 10 }, description: 'List first 10 profiles' },
    {
      options: { orderBy: 'net_worth_usd', orderDir: 'desc', size: 5 },
      description: 'Top 5 profiles by net worth',
    },
    {
      options: { page: 2, size: 20 },
      description: 'Get the second page of 20 profiles',
    },
    {
      options: {
        conditions: '[{"field":"users.net_worth_usd","op":"gt","value":10000}]',
        size: 20,
      },
      description: 'Search profiles with net worth > $10k',
    },
    {
      options: {
        conditions:
          '[{"field":"users.net_worth_usd","op":"gt","value":10000},{"field":"users.volume","op":"gt","value":1000}]',
        logic: 'or',
        size: 20,
      },
      description: 'Search profiles matching either condition (net worth or volume)',
    },
    {
      options: {
        conditions: '[{"field":"chains.1.balance","op":"gt","value":1000}]',
        size: 20,
      },
      description: 'Search profiles with > $1k balance on Ethereum (chain 1)',
    },
  ],
  hint: 'Requires profiles:read scope on your API key. Filter "field" must be a typed path (e.g. users.net_worth_usd) — bare names are ignored by the API.',
  run({ args: _args, options }) {
    return searchProfilesRun(options)
  },
})

// ── Update profile (merge identity properties) ──

export interface UpdateProfileOptions {
  properties: string
}

export function buildUpdateProfileBody(options: UpdateProfileOptions) {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(options.properties)
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('not an object')
  } catch {
    throw new Error('--properties must be a JSON object of property keys')
  }
  if (Object.keys(body).length === 0) {
    throw new Error('--properties must contain at least one key')
  }
  return body
}

export function updateProfileRun(
  address: string,
  options: UpdateProfileOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/profiles/${encodeURIComponent(address)}/properties`,
    buildUpdateProfileBody(options),
  )
}

profiles.command('update', {
  description: 'Merge-update identity properties on a wallet profile',
  args: z.object({
    address: z.string().describe('Wallet address (0x... or ENS name)'),
  }),
  options: z.object({
    properties: z
      .string()
      .describe(
        'JSON object of properties to merge. Allowed keys: user_id, display_name, email, farcaster, discord, twitter, telegram, instagram, website, github, linkedin, facebook, tiktok, youtube, reddit, avatar, description, location, ens, lens, basenames, linea',
      ),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: {
        properties: '{"display_name":"Vitalik","twitter":"VitalikButerin"}',
      },
      description: 'Set display name and Twitter handle',
    },
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { properties: '{"email":"alice@example.com"}' },
      description: 'Set just the email',
    },
  ],
  hint: 'Requires profiles:write scope on your API key. Only the listed keys are accepted; unknown keys are rejected.',
  run({ args, options }) {
    return updateProfileRun(args.address, options)
  },
})

// ── Labels sub-resource ──

export const profilesLabels = Cli.create('labels', {
  description: 'Manage labels on a wallet profile',
})

// ── Create / upsert profile label(s) ──

export interface CreateProfileLabelOptions {
  tagId?: string
  value?: string
  chainId?: string
  labels?: string
}

export function buildCreateLabelBody(options: CreateProfileLabelOptions): unknown {
  if (options.labels) {
    try {
      const parsed = JSON.parse(options.labels)
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error('not a non-empty array')
      return parsed
    } catch {
      throw new Error('--labels must be a non-empty JSON array of UserLabelInput objects')
    }
  }
  if (options.tagId) {
    const single: Record<string, string> = { tag_id: options.tagId }
    if (options.value) single.value = options.value
    if (options.chainId) single.chain_id = options.chainId
    return single
  }
  throw new Error('Provide --tag-id (single label) or --labels (batch JSON array)')
}

export function createProfileLabelRun(
  address: string,
  options: CreateProfileLabelOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.post(
    `/v0/profiles/${encodeURIComponent(address)}/labels`,
    buildCreateLabelBody(options),
  )
}

profilesLabels.command('create', {
  description: 'Upsert one or more labels on a wallet profile',
  args: z.object({
    address: z.string().describe('Wallet address (0x... or ENS name)'),
  }),
  options: z.object({
    tagId: z
      .string()
      .optional()
      .describe('Label identifier (e.g. "vip", "airdrop_eligible")'),
    value: z.string().optional().describe('Optional label value (e.g. tier name, country code)'),
    chainId: z.string().optional().describe('Optional chain identifier the label applies to'),
    labels: z
      .string()
      .optional()
      .describe('JSON array of UserLabelInput objects for batch upsert'),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { tagId: 'vip' },
      description: 'Tag a wallet as VIP',
    },
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { tagId: 'tier', value: 'gold', chainId: '1' },
      description: 'Apply a tiered label scoped to a chain',
    },
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { labels: '[{"tag_id":"vip"},{"tag_id":"airdrop_eligible","chain_id":"1"}]' },
      description: 'Apply multiple labels in one call',
    },
  ],
  hint: 'Requires profiles:write scope on your API key.',
  run({ args, options }) {
    return createProfileLabelRun(args.address, options)
  },
})

// ── Delete a profile label ──

export interface DeleteProfileLabelOptions {
  tagId: string
  chainId?: string
}

export function buildDeleteLabelBody(options: DeleteProfileLabelOptions) {
  if (!options.tagId) {
    throw new Error('--tag-id is required')
  }
  const body: Record<string, string> = { tag_id: options.tagId }
  if (options.chainId) body.chain_id = options.chainId
  return body
}

export function deleteProfileLabelRun(
  address: string,
  options: DeleteProfileLabelOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.delete(
    `/v0/profiles/${encodeURIComponent(address)}/labels`,
    { data: buildDeleteLabelBody(options) },
  )
}

profilesLabels.command('delete', {
  description: 'Delete a label from a wallet profile',
  args: z.object({
    address: z.string().describe('Wallet address (0x... or ENS name)'),
  }),
  options: z.object({
    tagId: z.string().describe('Label identifier to delete'),
    chainId: z.string().optional().describe('Optional chain identifier to scope the deletion'),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { tagId: 'vip' },
      description: 'Remove the vip label',
    },
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { tagId: 'tier', chainId: '1' },
      description: 'Remove a chain-scoped label',
    },
  ],
  hint: 'Requires profiles:write scope on your API key.',
  run({ args, options }) {
    return deleteProfileLabelRun(args.address, options)
  },
})

profiles.command(profilesLabels)
