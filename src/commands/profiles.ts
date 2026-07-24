import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import {
  parseJsonArrayOfObjects,
  parseJsonObject,
} from '../lib/json'

export const profiles = Cli.create('profiles', {
  description: 'Wallet profile commands',
})

export interface LifecycleThresholdOptions {
  newWindowDays?: number
  churnWindowDays?: number
  powerUserMinActiveDays?: number
  powerUserWindowDays?: number
  resurrectedGapDays?: number
  atRiskMinDaysInactive?: number
  atRiskPriorActiveDaysThreshold?: number
}

export interface GetProfileOptions extends LifecycleThresholdOptions {
  expand?: string
}

function addLifecycleThresholdParams(
  params: Record<string, string | number>,
  options: LifecycleThresholdOptions,
) {
  if (options.newWindowDays !== undefined) {
    params.new_window_days = options.newWindowDays
  }
  if (options.churnWindowDays !== undefined) {
    params.churn_window_days = options.churnWindowDays
  }
  if (options.powerUserMinActiveDays !== undefined) {
    params.power_user_min_active_days = options.powerUserMinActiveDays
  }
  if (options.powerUserWindowDays !== undefined) {
    params.power_user_window_days = options.powerUserWindowDays
  }
  if (options.resurrectedGapDays !== undefined) {
    params.resurrected_gap_days = options.resurrectedGapDays
  }
  if (options.atRiskMinDaysInactive !== undefined) {
    params.at_risk_min_days_inactive = options.atRiskMinDaysInactive
  }
  if (options.atRiskPriorActiveDaysThreshold !== undefined) {
    params.at_risk_prior_active_days_threshold =
      options.atRiskPriorActiveDaysThreshold
  }
}

const lifecycleThresholdOptions = {
  newWindowDays: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle new-user window in days'),
  churnWindowDays: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle churn window in days'),
  powerUserMinActiveDays: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle power-user minimum active days'),
  powerUserWindowDays: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle power-user window in days'),
  resurrectedGapDays: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle resurrected gap in days'),
  atRiskMinDaysInactive: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle at-risk minimum inactive days'),
  atRiskPriorActiveDaysThreshold: z.coerce
    .number()
    .optional()
    .describe('Override lifecycle at-risk prior active days threshold'),
}

export function getProfileRun(
  address: string,
  optionsOrExpand: GetProfileOptions | string = {},
) {
  requireApiKey()
  const client = createClient()
  const options =
    typeof optionsOrExpand === 'string'
      ? { expand: optionsOrExpand }
      : optionsOrExpand
  const params: Record<string, string | number> = {}
  if (options.expand) params.expand = options.expand
  addLifecycleThresholdParams(params, options)
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
    ...lifecycleThresholdOptions,
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
    return getProfileRun(args.address, options)
  },
})

export interface SearchProfilesOptions extends LifecycleThresholdOptions {
  address?: string
  search?: string
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
  if (options.search) params.search = options.search
  if (options.page !== undefined) params.page = options.page
  if (options.size !== undefined) params.size = options.size
  if (options.orderBy) params.order_by = options.orderBy
  if (options.orderDir) params.order_dir = options.orderDir
  if (options.expand) params.expand = options.expand
  addLifecycleThresholdParams(params, options)

  let body: object | undefined
  if (options.conditions) {
    body = {
      conditions: parseSearchConditions(options.conditions),
      logic: options.logic ?? 'and',
    }
  }

  // INTENTIONAL: the Formo search API is `GET /v0/profiles` with the
  // `{ conditions, logic }` filter object in the *request body* (see
  // docs.formo.so/api/profiles/search — it has a "Request Body (Filters)"
  // section under a GET endpoint). This GET-with-body shape is the
  // documented, server-supported contract. Do NOT "fix" it to POST — that
  // breaks the API. Filter-less searches still go over query params only.
  return client.request({ method: 'get', url: '/v0/profiles/', params, data: body })
}

profiles.command('search', {
  description: 'Search wallet profiles with optional filters',
  options: z.object({
    address: z.string().optional().describe('Filter by wallet address'),
    search: z.string().optional().describe('Free-text search across address and identity fields'),
    page: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('Page number (1-indexed, default 1)'),
    size: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('Page size (default 100, max 1000)'),
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
          'op: eq, neq, gt, gte, lt, lte, in, nin, contains, notEmpty, isEmpty ' +
          '(contains = substring, social fields only; notEmpty/isEmpty = value-less existence checks on string fields). ' +
          'Long-form spellings (equals, notEquals, greater, greaterOrEqual, less, lessOrEqual, notIn, includes) are retired; the API rejects them with a 400 naming the token.',
      ),
    logic: z
      .enum(['and', 'or'])
      .optional()
      .describe('Logic operator for combining conditions: "and" (default) or "or"'),
    ...lifecycleThresholdOptions,
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
  run({ options }) {
    return searchProfilesRun(options)
  },
})

// ── Update profile (merge identity properties) ──

export interface UpdateProfileOptions {
  properties: string
}

export function buildUpdateProfileBody(options: UpdateProfileOptions) {
  const body = parseJsonObject(options.properties, '--properties')
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

// ── Batch update profile properties ──

export interface BatchUpdateProfilesOptions {
  rows: string
}

export function buildBatchUpdateProfilesBody(
  options: BatchUpdateProfilesOptions,
) {
  const rows = parseJsonArrayOfObjects(options.rows, '--rows')
  if (rows.length === 0) {
    throw new Error('--rows must contain at least one item')
  }
  for (const row of rows) {
    if (typeof row.address !== 'string' || row.address.length === 0) {
      throw new Error('--rows entries must each include a non-empty string address')
    }
  }
  return rows
}

export function batchUpdateProfilesRun(options: BatchUpdateProfilesOptions) {
  requireApiKey()
  const client = createClient()
  return client.post(
    '/v0/profiles/properties',
    buildBatchUpdateProfilesBody(options),
  )
}

export const profilesProperties = Cli.create('properties', {
  description: 'Manage first-party profile properties in bulk',
})

profilesProperties.command('batch', {
  description: 'Batch update first-party profile properties for up to 100 wallets',
  options: z.object({
    rows: z
      .string()
      .describe(
        'JSON array of flat {address,...properties} objects. ENS names are not resolved in batch requests.',
      ),
  }),
  examples: [
    {
      options: {
        rows: '[{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","display_name":"alice.eth","email":"alice@example.com"}]',
      },
      description: 'Batch set display names and emails',
    },
  ],
  hint: 'Requires profiles:write scope on your API key. Unknown keys are ignored by the API; invalid rows are quarantined.',
  run({ options }) {
    return batchUpdateProfilesRun(options)
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
  timestamp?: string
  isDeleted?: boolean
  labels?: string
}

export function buildCreateLabelBody(options: CreateProfileLabelOptions): unknown {
  if (options.labels) {
    const parsed = parseJsonArrayOfObjects(options.labels, '--labels')
    if (parsed.length === 0) {
      throw new Error('--labels must contain at least one item')
    }
    for (const label of parsed) {
      if (typeof label.tag_id !== 'string' || label.tag_id.length === 0) {
        throw new Error('--labels entries must each include a non-empty string tag_id')
      }
    }
    return parsed
  }
  if (options.tagId) {
    const single: Record<string, string | number> = { tag_id: options.tagId }
    if (options.value !== undefined) single.value = options.value
    if (options.chainId) single.chain_id = options.chainId
    if (options.timestamp) single.timestamp = options.timestamp
    if (options.isDeleted !== undefined) {
      single._is_deleted = options.isDeleted ? 1 : 0
    }
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
    timestamp: z
      .string()
      .optional()
      .describe('Optional historical ISO-8601 timestamp for the label row'),
    isDeleted: z
      .boolean()
      .optional()
      .describe('Set true with --timestamp to backfill a label removal tombstone'),
    labels: z
      .string()
      .optional()
      .describe('JSON array of UserLabelInput objects for this wallet'),
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
      options: { tagId: 'tier', timestamp: '2024-03-15T00:00:00.000Z', isDeleted: true },
      description: 'Backfill a historical label removal',
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

// ── Batch upsert labels across wallets ──

export interface BatchCreateProfileLabelsOptions {
  labels: string
}

export function buildBatchCreateLabelsBody(
  options: BatchCreateProfileLabelsOptions,
) {
  const labels = parseJsonArrayOfObjects(options.labels, '--labels')
  if (labels.length === 0) {
    throw new Error('--labels must contain at least one item')
  }
  for (const label of labels) {
    if (typeof label.address !== 'string' || label.address.length === 0) {
      throw new Error('--labels entries must each include a non-empty string address')
    }
    if (typeof label.tag_id !== 'string' || label.tag_id.length === 0) {
      throw new Error('--labels entries must each include a non-empty string tag_id')
    }
  }
  return labels
}

export function batchCreateProfileLabelsRun(
  options: BatchCreateProfileLabelsOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.post(
    '/v0/profiles/labels',
    buildBatchCreateLabelsBody(options),
  )
}

profilesLabels.command('batch', {
  description: 'Batch upsert labels across up to 100 wallets',
  options: z.object({
    labels: z
      .string()
      .describe(
        'JSON array of {address,tag_id,value?,chain_id?,timestamp?,_is_deleted?} objects',
      ),
  }),
  examples: [
    {
      options: {
        labels: '[{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","tag_id":"vip","value":"tier-1"}]',
      },
      description: 'Batch upsert labels for multiple wallets',
    },
  ],
  hint: 'Requires profiles:write scope on your API key. ENS names are not resolved in batch requests.',
  run({ options }) {
    return batchCreateProfileLabelsRun(options)
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

profiles.command(profilesProperties)
profiles.command(profilesLabels)
