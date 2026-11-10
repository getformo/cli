import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import { parseJsonObject, parseStringArray } from '../lib/json'
import { stripTrailingFormatClause } from '../lib/sql'
import {
  buildPaginationParams,
  paginationOptionsSchema,
  type PaginationOptions,
} from '../lib/pagination'

export type { PaginationOptions }

export const charts = Cli.create('charts', {
  description:
    'Chart commands — create, list, query, move, duplicate, reorder, update, and delete charts within boards',
})

// ── Shared chart body builder ──
//
// A chart is `{ title, description, spec }`. The spec says what the chart
// computes (`spec.query`) and how it is drawn (`spec.view`, a Vega-Lite
// subset). See https://docs.formo.so/api/boards/create-chart.

export interface ChartBodyOptions {
  body?: string
  title?: string
  description?: string
  spec?: string
  sql?: string
  view?: string
  settings?: string
}

const CHART_SPEC_VERSION = 1

function hasTypedChartFields(options: ChartBodyOptions) {
  return [
    options.title,
    options.description,
    options.spec,
    options.sql,
    options.view,
    options.settings,
  ].some((value) => value !== undefined)
}

/**
 * Build a chart body. `base` is the current chart for an update, so
 * `--sql`, `--view` and `--settings` change one part of its spec and keep
 * the rest. Order: base, then --body, then --spec, then the typed flags.
 */
export function buildChartBody(
  options: ChartBodyOptions,
  base: Record<string, unknown> = {},
) {
  if (!options.body && !hasTypedChartFields(options)) {
    throw new Error(
      'Provide --body or chart fields such as --title, --spec, --sql and --view',
    )
  }

  const body: Record<string, unknown> = { ...base }
  if (options.body) Object.assign(body, parseJsonObject(options.body, '--body'))
  if (options.spec !== undefined) body.spec = parseJsonObject(options.spec, '--spec')
  if (options.title !== undefined) body.title = options.title
  if (options.description !== undefined) body.description = options.description

  if (
    options.sql !== undefined ||
    options.view !== undefined ||
    options.settings !== undefined
  ) {
    const spec: Record<string, unknown> = {
      version: CHART_SPEC_VERSION,
      ...((body.spec as Record<string, unknown> | undefined) ?? {}),
    }
    if (options.sql !== undefined) {
      const query = (spec.query as Record<string, unknown> | undefined) ?? {}
      spec.query = {
        ...(query.kind === 'sql' ? query : {}),
        kind: 'sql',
        sql: stripTrailingFormatClause(options.sql),
      }
    }
    if (options.settings !== undefined) {
      const query = (spec.query as Record<string, unknown> | undefined) ?? {}
      spec.query = { ...query, settings: parseJsonObject(options.settings, '--settings') }
    }
    if (options.view !== undefined) spec.view = parseJsonObject(options.view, '--view')
    body.spec = spec
  }

  return body
}

function coerceChartBody(
  input: string | ChartBodyOptions,
  base?: Record<string, unknown>,
) {
  return typeof input === 'string'
    ? buildChartBody({ body: input }, base)
    : buildChartBody(input, base)
}

const chartBodyOptions = z.object({
  body: z
    .string()
    .optional()
    .describe('Raw JSON chart body { title, description?, spec }. Typed flags below override matching keys.'),
  title: z.string().optional().describe('Chart title'),
  description: z.string().optional().describe('Optional chart description'),
  spec: z
    .string()
    .optional()
    .describe(
      'Chart spec JSON: { "version": 1, "query": {...}, "view": {...} }. query.kind is sql, funnel, retention or paths; view is a Vega-Lite subset (bar, line, area, arc, text) or x-table, x-funnel, x-retention, x-sankey',
    ),
  sql: z
    .string()
    .optional()
    .describe('SQL for a SQL chart: sets spec.query to { kind: "sql", sql }'),
  view: z
    .string()
    .optional()
    .describe(
      'View JSON, for example {"mark":"line","encoding":{"x":{"field":"date"},"y":{"field":"users"}}}',
    ),
  settings: z
    .string()
    .optional()
    .describe(
      'JSON object for spec.query.settings (for example, paths anchors/maxSteps/nodesPerStep or retention entryFilter/retentionFilter)',
    ),
})

// ── List charts for a board ──

export function listChartsRun(
  boardId: string,
  options: PaginationOptions = {},
  results = false,
) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}/charts/`, {
    params: {
      ...buildPaginationParams(options),
      // The public API returns lightweight summaries unless asked to execute.
      ...(results ? { include: 'results' } : {}),
    },
  })
}

charts.command('list', {
  description:
    'List charts for a board (summaries by default; --results executes each chart query)',
  options: z.object({
    boardId: z.string().describe('Board ID to list charts from'),
    results: z
      .boolean()
      .optional()
      .describe('Execute each chart query and include results (slower)'),
    ...paginationOptionsSchema,
  }),
  examples: [
    {
      options: { boardId: 'board_abc123' },
      description: 'List chart summaries for a board',
    },
    {
      options: { boardId: 'board_abc123', results: true },
      description: 'List charts with executed query results',
    },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ options }) {
    return listChartsRun(options.boardId, options, options.results ?? false)
  },
})

// ── List chart metadata for a board ──

export function listChartSummariesRun(
  boardId: string,
  options: PaginationOptions = {},
) {
  requireApiKey()
  const client = createClient()
  // Summaries are the list endpoint's default; /charts/meta is internal-only.
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}/charts/`, {
    params: buildPaginationParams(options),
  })
}

charts.command('meta', {
  description: 'List lightweight chart metadata for a board without query results',
  options: z.object({
    boardId: z.string().describe('Board ID to list chart metadata from'),
    ...paginationOptionsSchema,
  }),
  examples: [
    {
      options: { boardId: 'board_abc123', size: 25 },
      description: 'List chart summaries for a board',
    },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ options }) {
    return listChartSummariesRun(options.boardId, options)
  },
})

// ── Get a single chart ──

export function getChartRun(boardId: string, chartId: string) {
  requireApiKey()
  const client = createClient()
  return client.get(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
  )
}

charts.command('get', {
  description: 'Get a single chart by ID',
  args: z.object({
    chartId: z.string().describe('Chart ID'),
  }),
  options: z.object({
    boardId: z.string().describe('Board ID the chart belongs to'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: { boardId: 'board_abc123' },
      description: 'Get chart details',
    },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ args, options }) {
    return getChartRun(options.boardId, args.chartId)
  },
})

// ── Query a chart with date variables ──

export interface QueryChartOptions {
  dateFrom: string
  dateTo: string
}

export function queryChartRun(
  boardId: string,
  chartId: string,
  options: QueryChartOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.get(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}/query`,
    { params: { dateFrom: options.dateFrom, dateTo: options.dateTo } },
  )
}

charts.command('query', {
  description: 'Execute a saved chart query after substituting date variables',
  args: z.object({
    chartId: z.string().describe('Chart ID to query'),
  }),
  options: z.object({
    boardId: z.string().describe('Board ID the chart belongs to'),
    dateFrom: z.string().describe('Date variable value for {{date_from}}, YYYY-MM-DD'),
    dateTo: z.string().describe('Date variable value for {{date_to}}, YYYY-MM-DD'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: {
        boardId: 'board_abc123',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
      },
      description: 'Query a chart for April 2026',
    },
  ],
  hint: 'Requires boards:read scope and a chart query containing {{date_from}}/{{date_to}} variables.',
  run({ args, options }) {
    return queryChartRun(options.boardId, args.chartId, options)
  },
})

// ── Create a chart ──

export function createChartRun(
  boardId: string,
  input: string | ChartBodyOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.post(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/`,
    coerceChartBody(input),
  )
}

charts.command('create', {
  description: 'Create a new chart in a board',
  options: chartBodyOptions.extend({
    boardId: z.string().describe('Board ID to add the chart to'),
  }),
  examples: [
    {
      options: {
        boardId: 'board_abc123',
        title: 'Daily active users',
        sql: 'SELECT toDate(timestamp) AS date, countDistinct(address) AS users FROM events GROUP BY date ORDER BY date',
        view: '{"mark":"line","encoding":{"x":{"field":"date"},"y":{"field":"users"}}}',
      },
      description: 'Create a line chart from SQL and a view',
    },
    {
      options: {
        boardId: 'board_abc123',
        body: '{"title":"Onboarding Funnel","spec":{"version":1,"query":{"kind":"funnel","steps":[{"type":"event","event":"page"},{"type":"event","event":"connect"}]},"view":{"mark":"x-funnel"}}}',
      },
      description: 'Create a funnel chart from raw JSON',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ options }) {
    return createChartRun(options.boardId, options)
  },
})

// ── Update a chart ──

export function updateChartRun(
  boardId: string,
  chartId: string,
  input: string | ChartBodyOptions,
) {
  requireApiKey()
  const client = createClient()
  // Validate the flags before any request (invalid JSON fails here).
  coerceChartBody(input)

  // The charts endpoint only supports full-body PUT, so emulate a partial
  // update by fetching the current chart and applying the flags to it
  // (--sql, --view and --settings change one part of the spec). A concurrent
  // edit between the GET and PUT is overwritten.
  return client
    .get(
      `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
    )
    .then((current: unknown) => {
      const existing =
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)
          : {}
      const body = coerceChartBody(input, {
        title: existing.title,
        description: existing.description ?? undefined,
        spec: existing.spec,
      })

      return client.put(
        `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
        body,
      )
    })
}

charts.command('update', {
  description: 'Update an existing chart',
  args: z.object({
    chartId: z.string().describe('Chart ID to update'),
  }),
  options: chartBodyOptions.extend({
    boardId: z.string().describe('Board ID the chart belongs to'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: {
        boardId: 'board_abc123',
        title: 'Updated chart name',
      },
      description: 'Update a chart title',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return updateChartRun(options.boardId, args.chartId, options)
  },
})

// ── Move a chart ──

export function moveChartRun(
  boardId: string,
  chartId: string,
  targetBoardId: string,
) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}/move`,
    { targetBoardId },
  )
}

charts.command('move', {
  description: 'Move a chart to another board',
  args: z.object({
    chartId: z.string().describe('Chart ID to move'),
  }),
  options: z.object({
    boardId: z.string().describe('Current board ID'),
    targetBoardId: z.string().describe('Destination board ID'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: { boardId: 'board_source', targetBoardId: 'board_target' },
      description: 'Move a chart between boards',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return moveChartRun(options.boardId, args.chartId, options.targetBoardId)
  },
})

// ── Duplicate a chart ──

export function normalizeDuplicateChartResponse(result: unknown) {
  return typeof result === 'string' ? { id: result } : result
}

export function duplicateChartRun(boardId: string, chartId: string) {
  requireApiKey()
  const client = createClient()
  return client.post(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}/duplicate`,
  ).then(normalizeDuplicateChartResponse)
}

charts.command('duplicate', {
  description: 'Duplicate a chart within its board',
  args: z.object({
    chartId: z.string().describe('Chart ID to duplicate'),
  }),
  options: z.object({
    boardId: z.string().describe('Board ID the chart belongs to'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: { boardId: 'board_abc123' },
      description: 'Duplicate a chart',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return duplicateChartRun(options.boardId, args.chartId)
  },
})

// ── Reorder charts ──

export function reorderChartsRun(boardId: string, chartIds: string) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/reorder`,
    { chartIds: parseStringArray(chartIds, '--chart-ids') },
  )
}

charts.command('reorder', {
  description: 'Reorder charts in a board',
  options: z.object({
    boardId: z.string().describe('Board ID whose charts should be reordered'),
    chartIds: z
      .string()
      .describe('Chart IDs in desired order, as comma-separated text or JSON array'),
  }),
  examples: [
    {
      options: {
        boardId: 'board_abc123',
        chartIds: 'chart_a,chart_b,chart_c',
      },
      description: 'Reorder charts using comma-separated IDs',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ options }) {
    return reorderChartsRun(options.boardId, options.chartIds)
  },
})

// ── Delete a chart ──

export function deleteChartRun(boardId: string, chartId: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
  )
}

charts.command('delete', {
  description: 'Delete a chart',
  args: z.object({
    chartId: z.string().describe('Chart ID to delete'),
  }),
  options: z.object({
    boardId: z.string().describe('Board ID the chart belongs to'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: { boardId: 'board_abc123' },
      description: 'Delete a chart',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return deleteChartRun(options.boardId, args.chartId)
  },
})
