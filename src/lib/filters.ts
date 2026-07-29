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
