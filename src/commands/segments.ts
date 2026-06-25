import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const segments = Cli.create('segments', {
  description: 'User segment commands — create, list, and delete audience segments',
})

// ── List segments ──

export interface PaginationOptions {
  page?: number
  size?: number
}

function buildPaginationParams(options: PaginationOptions = {}) {
  const params: Record<string, number> = {}
  if (options.page !== undefined) params.page = options.page
  if (options.size !== undefined) params.size = options.size
  return params
}

export function listSegmentsRun(options: PaginationOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/segments/', { params: buildPaginationParams(options) })
}

segments.command('list', {
  description: 'List all user segments for the project',
  options: z.object({
    page: z.coerce.number().optional().describe('Page number (1-indexed, default 1)'),
    size: z.coerce.number().optional().describe('Page size (default 100, max 200)'),
  }),
  examples: [{ description: 'List all project segments' }],
  hint: 'Requires segments:read scope on your API key.',
  run({ options }) {
    return listSegmentsRun(options)
  },
})

// ── Create a segment ──

export interface CreateSegmentOptions {
  title: string
  filterSets: string
}

export function buildCreateSegmentBody(options: CreateSegmentOptions) {
  let parsedFilterSets: unknown
  try {
    parsedFilterSets = JSON.parse(options.filterSets)
    if (!Array.isArray(parsedFilterSets)) {
      throw new Error('not an array')
    }
  } catch {
    throw new Error('--filter-sets must be a valid JSON array')
  }

  return {
    title: options.title,
    filterSets: parsedFilterSets,
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
    filterSets: z
      .string()
      .describe('JSON array of filter set strings defining the segment'),
  }),
  examples: [
    {
      options: {
        title: 'Whales',
        filterSets: '["net_worth_usd > 100000"]',
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
