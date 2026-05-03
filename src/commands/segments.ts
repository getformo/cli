import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const segments = Cli.create('segments', {
  description: 'User segment commands — create, list, and delete audience segments',
})

// ── List segments ──

export function listSegmentsRun() {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/segments/')
}

segments.command('list', {
  description: 'List all user segments for the project',
  examples: [{ description: 'List all project segments' }],
  hint: 'Requires segments:read scope on your API key.',
  run() {
    return listSegmentsRun()
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
  } catch {
    throw new Error('--filterSets must be a valid JSON array')
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
