import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import {
  isCanonicalFilterOperator,
  isEmptyMembershipArray,
  isValuelessFilterOperator,
} from '../lib/filters'
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
  filters?: string
  logic?: 'and' | 'or'
}

// Prefixes that may lead a user-surface `field` (e.g. `users.net_worth_usd`).
// A bare name like `net_worth_usd` is silently ignored server-side (no error,
// no filtering — the search returns everything), so we reject it client-side.
const USER_FIELD_PREFIXES = new Set(['user', 'users'])

// The four canonical resource filter fields. Resource identity lives in named
// qualifier properties — never in the field path. The retired
// identifier-in-path spellings (`chains.1.balance`, `apps.uniswap-v3.balance`,
// `tokens.0x….balance`, `labels.vip`) are rejected by the API with a 400.
const RESOURCE_FILTER_FIELDS = new Set([
  'chains.balance',
  'apps.balance',
  'tokens.balance',
  'labels.value',
])

// Prefixes owned by the resource fields above. A field that leads with one of
// these but is not an exact canonical path is a retired dynamic path.
const RESOURCE_FIELD_PREFIXES = new Set([
  'chain',
  'chains',
  'app',
  'apps',
  'token',
  'tokens',
  'label',
  'labels',
])

const QUALIFIER_KEYS = [
  'chain_id',
  'app_id',
  'token_address',
  'tag_id',
  'scope',
] as const

const FILTER_ENTRY_KEYS = new Set<string>([
  'field',
  'op',
  'value',
  ...QUALIFIER_KEYS,
])

/**
 * Enforce the per-field qualifier rules, mirroring the API's schema. Sending a
 * qualifier the field does not accept — or omitting a required one — is a 400,
 * so we fail here with a message that names the offending key.
 */
function validateQualifiers(
  record: Record<string, unknown>,
  field: string,
): void {
  const present = (key: string) => record[key] !== undefined
  const required = (key: string) => {
    if (!present(key)) {
      throw new Error(`--filters: "${key}" is required for "${field}"`)
    }
  }
  const forbidden = (keys: readonly string[]) => {
    for (const key of keys) {
      if (present(key)) {
        throw new Error(`--filters: "${key}" is not valid for "${field}"`)
      }
    }
  }

  switch (field) {
    case 'chains.balance':
      // chain_id optional — omit it to match any chain.
      forbidden(['app_id', 'token_address', 'tag_id', 'scope'])
      break
    case 'apps.balance':
      required('app_id')
      forbidden(['token_address', 'tag_id', 'scope'])
      break
    case 'tokens.balance':
      required('token_address')
      required('scope')
      if (record.scope !== 'any' && record.scope !== 'protocol') {
        throw new Error(`--filters: "scope" must be "any" or "protocol"`)
      }
      // app_id identifies the protocol, so it is required by (and only by)
      // scope: "protocol".
      if (record.scope === 'protocol') {
        required('app_id')
      } else {
        forbidden(['app_id'])
      }
      forbidden(['tag_id'])
      break
    case 'labels.value':
      required('tag_id')
      forbidden(['app_id', 'token_address', 'scope'])
      break
    default:
      // users.* — a user attribute carries no resource identity.
      forbidden(QUALIFIER_KEYS)
  }
}

/**
 * Parse and validate the --filters JSON. Ensures it is an array of
 * `{ field, op, value }` objects carrying a canonical `field` — either
 * `users.{attribute}` or one of the four stable resource paths, with resource
 * identity in named qualifier properties. Exported for unit testing.
 */
export function parseSearchFilters(raw: string): unknown[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('--filters must be a valid JSON array of FilterCondition objects')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('--filters must be a valid JSON array of FilterCondition objects')
  }
  for (const filter of parsed) {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      throw new Error('--filters: each entry must be an object with field, op, value')
    }
    const record = filter as Record<string, unknown>
    const field = record.field
    if (typeof field !== 'string' || field.length === 0) {
      throw new Error('--filters: each entry must have a non-empty string "field"')
    }
    for (const key of Object.keys(record)) {
      if (!FILTER_ENTRY_KEYS.has(key)) {
        // `appId` was the pre-P-2387 spelling; the API now rejects unknown keys.
        const hint =
          key === 'appId' ? ' — use the snake_case "app_id" qualifier' : ''
        throw new Error(`--filters: unknown property "${key}"${hint}`)
      }
    }
    const prefix = field.split('.')[0]
    if (!RESOURCE_FILTER_FIELDS.has(field)) {
      if (RESOURCE_FIELD_PREFIXES.has(prefix)) {
        throw new Error(
          `--filters: field "${field}" is a retired identifier-in-path spelling. ` +
            'Use a stable path — chains.balance, apps.balance, tokens.balance, or labels.value — ' +
            'and move the identifier into a qualifier (chain_id, app_id, token_address, tag_id). ' +
            'The API rejects the old form with a 400.',
        )
      }
      if (!field.includes('.') || !USER_FIELD_PREFIXES.has(prefix)) {
        throw new Error(
          `--filters: field "${field}" must be a canonical path — either ` +
            'users.{attribute}, or one of chains.balance, apps.balance, tokens.balance, labels.value ' +
            '(a bare name is silently ignored by the API and returns the entire unfiltered dataset)',
        )
      }
    }
    validateQualifiers(record, field)
    // The balance fields compare numerically; a stringified number is a 400.
    if (
      field !== 'labels.value' &&
      RESOURCE_FILTER_FIELDS.has(field) &&
      typeof record.value !== 'number'
    ) {
      throw new Error(`--filters: "value" must be a number for "${field}"`)
    }
    if (field === 'labels.value' && record.value === '') {
      throw new Error(`--filters: "value" must be non-empty for "labels.value"`)
    }
    if (!isCanonicalFilterOperator(record.op)) {
      throw new Error(
        '--filters: each entry must use a canonical "op" (eq, neq, gt, lt, gte, lte, in, nin, startsWith, endsWith, contains, notEmpty, or isEmpty)',
      )
    }
    if (isEmptyMembershipArray(record.value)) {
      throw new Error('--filters: membership arrays cannot be empty')
    }
    if (
      !isValuelessFilterOperator(record.op) &&
      (record.value === undefined || record.value === null)
    ) {
      throw new Error(
        '--filters: "value" is required for every operator except notEmpty/isEmpty',
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
  if (options.filters) {
    body = {
      filters: parseSearchFilters(options.filters),
      logic: options.logic ?? 'and',
    }
  }

  // INTENTIONAL: the Formo search API is `GET /v0/profiles` with the
  // `{ filters, logic }` filter object in the *request body* (see
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
    filters: z
      .string()
      .optional()
      .describe(
        'JSON array of FilterCondition objects: [{"field","op","value"}]. ' +
          'The "field" MUST be a typed path — a bare name like "net_worth_usd" is silently ignored. ' +
          'Profile: users.net_worth_usd, users.volume, users.revenue, users.points. ' +
          'Engagement: users.device, users.browser, users.os, users.location, users.lifecycle. ' +
          'Socials: users.ens, users.farcaster, users.lens, etc. ' +
          'Resource filters use a stable field plus named qualifiers: ' +
          'chains.balance (+ optional "chain_id"); ' +
          'apps.balance (+ "app_id", optional "chain_id"); ' +
          'tokens.balance (+ "token_address", "scope":"any"|"protocol", "app_id" when scope is "protocol", optional "chain_id"); ' +
          'labels.value (+ "tag_id", optional "chain_id"). ' +
          'op: eq, neq, gt, gte, lt, lte, in, nin, contains, startsWith, endsWith, notEmpty, isEmpty. ' +
          'Operator support is per field: the .balance fields take comparison operators only; ' +
          'contains works on routable string attributes (users.device, users.os, users.referrer, users.utm_*, users.click_id — case-sensitive), ' +
          'on social fields and on labels.value (case-insensitive); ' +
          'startsWith/endsWith are routable string attributes only; ' +
          'notEmpty/isEmpty are value-less existence checks on string fields; ' +
          'users.lifecycle takes only eq and in. ' +
          'Retired and rejected with a 400: identifier-in-path fields (chains.1.balance, apps.uniswap-v3.balance, tokens.0x….balance, labels.vip), ' +
          'the "appId" spelling, and long-form operators (equals, notEquals, greater, greaterOrEqual, less, lessOrEqual, notIn, includes).',
      ),
    logic: z
      .enum(['and', 'or'])
      .optional()
      .describe('Logic operator for combining filters: "and" (default) or "or"'),
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
        filters: '[{"field":"users.net_worth_usd","op":"gt","value":10000}]',
        size: 20,
      },
      description: 'Search profiles with net worth > $10k',
    },
    {
      options: {
        filters:
          '[{"field":"users.net_worth_usd","op":"gt","value":10000},{"field":"users.volume","op":"gt","value":1000}]',
        logic: 'or',
        size: 20,
      },
      description: 'Search profiles matching either condition (net worth or volume)',
    },
    {
      options: {
        filters:
          '[{"field":"chains.balance","op":"gt","value":1000,"chain_id":"1"}]',
        size: 20,
      },
      description: 'Search profiles with > $1k balance on Ethereum (chain 1)',
    },
    {
      options: {
        filters:
          '[{"field":"labels.value","op":"eq","value":"tier-1","tag_id":"vip"}]',
        size: 20,
      },
      description: 'Search profiles carrying the vip label with value tier-1',
    },
  ],
  hint: 'Requires profiles:read scope on your API key. Filter "field" must be a canonical path (users.{attribute}, chains.balance, apps.balance, tokens.balance, labels.value) with resource identity in the chain_id/app_id/token_address/tag_id qualifiers — bare names are ignored by the API and identifier-in-path fields are rejected with a 400.',
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
