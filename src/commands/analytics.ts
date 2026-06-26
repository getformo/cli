import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const analytics = Cli.create('analytics', {
  description:
    'Pre-built analytics query commands — KPIs, funnels, retention, revenue, and top-N breakdowns',
})

// The pre-built analytics pipes exposed at GET /v0/<pipe>. Each requires the
// query:read scope. Common params (date_from, date_to, filters) are shared;
// pipe-specific params (e.g. funnel `steps`, kpis `group_by`, `limit`) are
// passed through the generic --params JSON object.
const PIPES: Array<{ name: string; description: string }> = [
  { name: 'kpis', description: 'Traffic KPIs: visitors, pageviews, bounce rate, session duration' },
  { name: 'event_timeseries', description: 'Event counts over time' },
  { name: 'funnel', description: 'Conversion funnel across ordered steps. --params: steps (JSON array of {type,event,name,filters?}), window_seconds, funnel_type, group_by, limit, attribution' },
  { name: 'flow', description: 'User path/flow analysis. --params: start_step / end_step (JSON {type,event,...}), global_filters, window_seconds, max_steps' },
  { name: 'frequency', description: 'Engagement frequency distribution' },
  { name: 'lifecycle', description: 'User lifecycle stages (new, returning, power, resurrected, churned)' },
  { name: 'retention', description: 'Retention cohort analysis (params: id_type, event_type, event_name, min_users)' },
  { name: 'revenue_overview', description: 'Revenue overview with optional breakdown (params: group_by, rank_by)' },
  { name: 'revenue_by_metric', description: 'Revenue ranked by a metric column (params: metric_column, limit, offset)' },
  { name: 'revenue_timeseries', description: 'Revenue over time (params: address)' },
  { name: 'volume_by_metric', description: 'Trading volume ranked by a metric column (params: metric_column, limit, offset)' },
  { name: 'top_chains', description: 'Top chains by activity (params: limit, offset)' },
  { name: 'top_events', description: 'Top events by count (params: limit, offset, type)' },
  { name: 'top_locations', description: 'Top locations (params: limit, offset)' },
  { name: 'top_pages', description: 'Top pages by traffic (params: limit, offset, mode)' },
  { name: 'top_sources', description: 'Top acquisition sources (params: metric_column, limit, offset)' },
  { name: 'top_wallets', description: 'Top wallets by activity (params: limit, offset)' },
]

export interface AnalyticsOptions {
  dateFrom?: string
  dateTo?: string
  filters?: string
  params?: string
}

// Keys --params is not allowed to set: they have dedicated, validated flags
// (--date-from/--date-to/--filters). Rejecting them prevents --params from
// silently overriding validated input or pushing an invalid `filters` value
// (e.g. a non-JSON string) over the wire. Both casings of the date keys are
// rejected so a stray camelCase key can't slip through unvalidated.
const RESERVED_PARAM_KEYS = new Set([
  'date_from',
  'date_to',
  'dateFrom',
  'dateTo',
  'filters',
])

/**
 * Build the query-string params for an analytics pipe request.
 *
 * - `dateFrom`/`dateTo` map to the API's snake_case `date_from`/`date_to`.
 *   All pipes, including `funnel` and `flow`, use snake_case.
 * - `filters` is a JSON array of `{ field, op, value }` objects, re-serialized
 *   as a JSON string (the pipe expects a JSON-encoded array in the query).
 * - `params` is a JSON object of any pipe-specific params (e.g. funnel
 *   `steps`, kpis `group_by`, `limit`). Object/array values are JSON-encoded
 *   (pipes like funnel expect `steps` as a JSON-encoded string); primitives
 *   pass through unchanged. Reserved keys (the date/filters flags) are
 *   rejected, and the validated flags below always take precedence.
 *
 * Exported for unit testing.
 */
export function buildAnalyticsParams(
  options: AnalyticsOptions,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}

  // --params first, so the validated flags below override it.
  if (options.params) {
    let parsed: unknown
    try {
      parsed = JSON.parse(options.params)
    } catch {
      throw new Error('--params must be a valid JSON object')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('--params must be a valid JSON object')
    }
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (RESERVED_PARAM_KEYS.has(key)) {
        throw new Error(
          `--params may not set "${key}" — use the --date-from/--date-to/--filters flags instead`,
        )
      }
      if (value === null || value === undefined) continue
      if (typeof value === 'object') {
        out[key] = JSON.stringify(value)
      } else {
        out[key] = value as string | number | boolean
      }
    }
  }

  if (options.dateFrom) out.date_from = options.dateFrom
  if (options.dateTo) out.date_to = options.dateTo

  if (options.filters) {
    let parsed: unknown
    try {
      parsed = JSON.parse(options.filters)
    } catch {
      throw new Error(
        '--filters must be a valid JSON array of {field,op,value} objects',
      )
    }
    if (!Array.isArray(parsed)) {
      throw new Error(
        '--filters must be a valid JSON array of {field,op,value} objects',
      )
    }
    out.filters = JSON.stringify(parsed)
  }

  return out
}

export function runAnalytics(pipe: string, options: AnalyticsOptions) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/${pipe}`, { params: buildAnalyticsParams(options) })
}

const sharedOptions = z.object({
  dateFrom: z
    .string()
    .optional()
    .describe('Inclusive start date YYYY-MM-DD (default: 7 days before --date-to)'),
  dateTo: z
    .string()
    .optional()
    .describe('Inclusive end date YYYY-MM-DD (default: today)'),
  filters: z
    .string()
    .optional()
    .describe(
      'JSON array of filter conditions: [{"field","op","value"}]. ' +
        'Use op "in"/"notIn" with a pipe-delimited value (e.g. "chrome|firefox").',
    ),
  params: z
    .string()
    .optional()
    .describe(
      'JSON object of pipe-specific params merged into the query, e.g. ' +
        '{"limit":10,"group_by":"device"} or funnel ' +
        '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]}]}. ' +
        'May not set date_from/date_to/filters; use the dedicated --date-from/--date-to/--filters flags.',
    ),
})

for (const pipe of PIPES) {
  analytics.command(pipe.name, {
    description: pipe.description,
    options: sharedOptions,
    examples: [
      {
        description: `Get ${pipe.name} for the last 7 days (default range)`,
      },
      {
        options: { dateFrom: '2026-04-01', dateTo: '2026-04-30' },
        description: `Get ${pipe.name} for April 2026`,
      },
    ],
    hint: 'Requires query:read scope on your API key. Pass pipe-specific params via --params.',
    run({ options }) {
      return runAnalytics(pipe.name, options)
    },
  })
}
