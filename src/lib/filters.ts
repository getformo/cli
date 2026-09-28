export const CANONICAL_FILTER_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'nin',
  'startsWith',
  'endsWith',
  'contains',
  'notEmpty',
  'isEmpty',
] as const

const CANONICAL_FILTER_OPERATOR_SET = new Set<string>(
  CANONICAL_FILTER_OPERATORS,
)

export function isCanonicalFilterOperator(op: unknown): op is string {
  return typeof op === 'string' && CANONICAL_FILTER_OPERATOR_SET.has(op)
}

export function isValuelessFilterOperator(op: unknown): boolean {
  return op === 'notEmpty' || op === 'isEmpty'
}

export function isCanonicalFilterValue(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (item) => typeof item === 'string' || typeof item === 'number',
      ))
  )
}

export function isEmptyMembershipArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0
}

export function hasTinybirdMembershipDelimiter(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((item) => typeof item === 'string' && item.includes('|'))
  )
}

export const QUALIFIER_KEYS = [
  'chain_id',
  'app_id',
  'token_address',
  'tag_id',
  'scope',
] as const

/**
 * Enforce the per-field qualifier rules, mirroring the API's schema. Sending a
 * qualifier the field does not accept — or omitting a required one — is a 400,
 * so we fail here with a message that names the offending key.
 */
export function validateQualifiers(
  record: Record<string, unknown>,
  field: string,
  path = '--filters',
): void {
  for (const key of QUALIFIER_KEYS) {
    if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key] === '')) {
      throw new Error(`${path}.${key} must be a non-empty string`)
    }
  }
  if (record.scope !== undefined && record.scope !== 'any' && record.scope !== 'protocol') {
    throw new Error(`${path}.scope must be any or protocol`)
  }
  const present = (key: string) => record[key] !== undefined
  const required = (key: string) => {
    if (!present(key)) {
      throw new Error(`${path}: "${key}" is required for "${field}"`)
    }
  }
  const forbidden = (keys: readonly string[]) => {
    for (const key of keys) {
      if (present(key)) {
        throw new Error(`${path}: "${key}" is not valid for "${field}"`)
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
        throw new Error(`${path}: "scope" must be "any" or "protocol"`)
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
