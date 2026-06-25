import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import {
  parseJsonArray,
  parseJsonObject,
  parseStringArray,
} from '../lib/json'
import { stripTrailingFormatClause } from '../lib/sql'

export const charts = Cli.create('charts', {
  description:
    'Chart commands — create, list, query, move, duplicate, reorder, update, and delete charts within boards',
})

const chartTypeSchema = z.enum([
  'table',
  'number',
  'funnel',
  'bar',
  'line',
  'area',
  'pie',
  'stacked',
  'user_paths',
  'retention',
])

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

// ── Shared chart body builder ──

export interface ChartBodyOptions {
  body?: string
  query?: string
  chartType?: string
  title?: string
  description?: string
  xAxis?: string
  yAxis?: string
  groupBy?: string
  steps?: string
  settings?: string
}

function hasTypedChartFields(options: ChartBodyOptions) {
  return [
    options.query,
    options.chartType,
    options.title,
    options.description,
    options.xAxis,
    options.yAxis,
    options.groupBy,
    options.steps,
    options.settings,
  ].some((value) => value !== undefined)
}

export function buildChartBody(options: ChartBodyOptions) {
  let body: Record<string, unknown> = {}

  if (options.body) {
    body = parseJsonObject(options.body, '--body')
  }

  if (!options.body && !hasTypedChartFields(options)) {
    throw new Error(
      'Provide --body or chart fields such as --title, --chart-type, and --query',
    )
  }

  if (options.query !== undefined) {
    body.query = stripTrailingFormatClause(options.query)
  }
  if (options.chartType !== undefined) body.chart_type = options.chartType
  if (options.title !== undefined) body.title = options.title
  if (options.description !== undefined) body.description = options.description
  if (options.xAxis !== undefined) body.x_axis = options.xAxis
  if (options.yAxis !== undefined) {
    body.y_axis = parseStringArray(options.yAxis, '--y-axis')
  }
  if (options.groupBy !== undefined) body.group_by = options.groupBy
  if (options.steps !== undefined) {
    body.steps = parseJsonArray(options.steps, '--steps')
  }
  if (options.settings !== undefined) {
    body.settings = parseJsonObject(options.settings, '--settings')
  }

  return body
}

function coerceChartBody(input: string | ChartBodyOptions) {
  return typeof input === 'string' ? buildChartBody({ body: input }) : buildChartBody(input)
}

const chartBodyOptions = z.object({
  body: z
    .string()
    .optional()
    .describe('Raw JSON chart body. Typed flags below override matching body keys.'),
  query: z
    .string()
    .optional()
    .describe('SQL query powering table/number/bar/line/area/pie/stacked charts'),
  chartType: chartTypeSchema.optional().describe('Chart type'),
  title: z.string().optional().describe('Chart title'),
  description: z.string().optional().describe('Optional chart description'),
  xAxis: z.string().optional().describe('Column used as the x axis'),
  yAxis: z
    .string()
    .optional()
    .describe('Comma-separated or JSON array of y-axis metric columns'),
  groupBy: z.string().optional().describe('Column used to group or stack series'),
  steps: z
    .string()
    .optional()
    .describe('JSON array of funnel/user-path step objects'),
  settings: z
    .string()
    .optional()
    .describe('JSON object of type-specific chart settings'),
})

// ── List charts for a board ──

export function listChartsRun(
  boardId: string,
  options: PaginationOptions = {},
) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}/charts/`, {
    params: buildPaginationParams(options),
  })
}

charts.command('list', {
  description: 'List all charts for a board, including executed results',
  options: z.object({
    boardId: z.string().describe('Board ID to list charts from'),
    page: z.coerce.number().optional().describe('Page number (1-indexed, default 1)'),
    size: z.coerce.number().optional().describe('Page size (default 100, max 200)'),
  }),
  examples: [
    {
      options: { boardId: 'board_abc123' },
      description: 'List all charts in a board',
    },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ options }) {
    return listChartsRun(options.boardId, options)
  },
})

// ── List chart metadata for a board ──

export function listChartSummariesRun(
  boardId: string,
  options: PaginationOptions = {},
) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}/charts/meta`, {
    params: buildPaginationParams(options),
  })
}

charts.command('meta', {
  description: 'List lightweight chart metadata for a board without query results',
  options: z.object({
    boardId: z.string().describe('Board ID to list chart metadata from'),
    page: z.coerce.number().optional().describe('Page number (1-indexed, default 1)'),
    size: z.coerce.number().optional().describe('Page size (default 100, max 200)'),
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
        chartType: 'line',
        query:
          'SELECT toDate(timestamp) AS date, countDistinct(address) AS users FROM events GROUP BY date ORDER BY date',
        xAxis: 'date',
        yAxis: 'users',
      },
      description: 'Create a line chart from typed flags',
    },
    {
      options: {
        boardId: 'board_abc123',
        body: '{"title":"Onboarding Funnel","chart_type":"funnel","query":"SELECT 1","steps":[{"type":"event","event":"page"},{"type":"event","event":"connect"}]}',
      },
      description: 'Create a chart from raw JSON',
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
  const updates = coerceChartBody(input)

  return client
    .get(
      `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
    )
    .then((current: unknown) => {
      const existing =
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)
          : {}
      const body = {
        query: existing.query,
        chart_type: existing.chart_type,
        title: existing.title,
        description: existing.description ?? undefined,
        x_axis: existing.x_axis ?? undefined,
        y_axis: existing.y_axis ?? undefined,
        group_by: existing.group_by ?? undefined,
        steps: existing.steps ?? undefined,
        settings: existing.settings ?? undefined,
        ...updates,
      }

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
