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
      value.every(
        (item) => typeof item === 'string' || typeof item === 'number',
      ))
  )
}

export function hasTinybirdMembershipDelimiter(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((item) => typeof item === 'string' && item.includes('|'))
  )
}
