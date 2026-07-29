import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import {
  isCanonicalFilterOperator,
  isValuelessFilterOperator,
} from '../lib/filters'
import { parseJsonArray } from '../lib/json'
import {
  buildPaginationParams,
  paginationOptionsSchema,
  type PaginationOptions,
} from '../lib/pagination'

export type { PaginationOptions }

export const segments = Cli.create('segments', {
  description: 'User segment commands — create, list, and delete audience segments',
})

// ── List segments ──

export function listSegmentsRun(options: PaginationOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/segments/', { params: buildPaginationParams(options) })
}

segments.command('list', {
  description: 'List all user segments for the project',
  options: z.object(paginationOptionsSchema),
  examples: [{ description: 'List all project segments' }],
  hint: 'Requires segments:read scope on your API key.',
  run({ options }) {
    return listSegmentsRun(options)
  },
})

// ── Create a segment ──

export interface CreateSegmentOptions {
  title: string
  filters: string
}

const SEGMENT_FILTER_KEYS = new Set(['field', 'op', 'value'])

function isSegmentFilterValue(value: unknown): boolean {
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

export function buildCreateSegmentBody(options: CreateSegmentOptions) {
  const filters = parseJsonArray(options.filters, '--filters')
  if (filters.length === 0) {
    throw new Error('--filters must contain at least one filter')
  }

  for (const filter of filters) {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      throw new Error(
        '--filters must be a JSON array of {field, op, value} objects',
      )
    }
    const record = filter as Record<string, unknown>
    if (Object.keys(record).some((key) => !SEGMENT_FILTER_KEYS.has(key))) {
      throw new Error(
        '--filters entries may only contain field, op, and value',
      )
    }
    if (typeof record.field !== 'string' || record.field.length === 0) {
      throw new Error('--filters: each entry requires a non-empty string "field"')
    }
    if (!isCanonicalFilterOperator(record.op)) {
      throw new Error('--filters: each entry requires a canonical "op"')
    }
    if (
      !isValuelessFilterOperator(record.op) &&
      (record.value === undefined ||
        record.value === null ||
        !isSegmentFilterValue(record.value))
    ) {
      throw new Error(
        '--filters: "value" is required for every operator except notEmpty/isEmpty',
      )
    }
    if (
      record.value !== undefined &&
      record.value !== null &&
      !isSegmentFilterValue(record.value)
    ) {
      throw new Error(
        '--filters: "value" must be a string, number, boolean, or string/number array',
      )
    }
  }

  return {
    title: options.title,
    filters,
  }
}

export function createSegmentRun(options: CreateSegmentOptions) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/segments/', buildCreateSegmentBody(options))
}

segments.command('create', {
  description: 'Create a new user segment',
  options: z.object({
    title: z.string().describe('Segment title'),
    filters: z
      .string()
      .describe(
        'JSON array of canonical filter objects: [{"field","op","value"}]',
      ),
  }),
  examples: [
    {
      options: {
        title: 'Whales',
        filters:
          '[{"field":"net_worth_usd","op":"gt","value":"100000"}]',
      },
      description: 'Create a high-value segment',
    },
  ],
  hint: 'Requires segments:write scope on your API key.',
  run({ options }) {
    return createSegmentRun(options)
  },
})

// ── Delete a segment ──

export function deleteSegmentRun(segmentId: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(`/v0/segments/${encodeURIComponent(segmentId)}`)
}

segments.command('delete', {
  description: 'Delete a user segment',
  args: z.object({
    segmentId: z.string().describe('Segment ID to delete'),
  }),
  examples: [
    { args: { segmentId: 'seg_abc123' }, description: 'Delete a segment' },
  ],
  hint: 'Requires segments:write scope on your API key.',
  run({ args }) {
    return deleteSegmentRun(args.segmentId)
  },
})
