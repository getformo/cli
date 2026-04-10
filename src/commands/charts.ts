import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const charts = Cli.create('charts', {
  description: 'Chart commands — create, list, update, and delete charts within boards',
})

// ── List charts for a board ──

export function listChartsRun(boardId: string) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}/charts/`)
}

charts.command('list', {
  description: 'List all charts for a board',
  options: z.object({
    boardId: z.string().describe('Board ID to list charts from'),
  }),
  examples: [
    {
      options: { boardId: 'board_abc123' },
      description: 'List all charts in a board',
    },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ options }) {
    return listChartsRun(options.boardId)
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

// ── Create a chart ──

export function createChartRun(boardId: string, body: string) {
  requireApiKey()
  const client = createClient()

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('--body must be valid JSON')
  }

  return client.post(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/`,
    parsed,
  )
}

charts.command('create', {
  description: 'Create a new chart in a board',
  options: z.object({
    boardId: z.string().describe('Board ID to add the chart to'),
    body: z.string().describe('JSON string with chart configuration'),
  }),
  examples: [
    {
      options: {
        boardId: 'board_abc123',
        body: '{"name":"Daily active users","chartType":"line"}',
      },
      description: 'Create a line chart',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ options }) {
    return createChartRun(options.boardId, options.body)
  },
})

// ── Update a chart ──

export function updateChartRun(boardId: string, chartId: string, body: string) {
  requireApiKey()
  const client = createClient()

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('--body must be valid JSON')
  }

  return client.put(
    `/v0/boards/${encodeURIComponent(boardId)}/charts/${encodeURIComponent(chartId)}`,
    parsed,
  )
}

charts.command('update', {
  description: 'Update an existing chart',
  args: z.object({
    chartId: z.string().describe('Chart ID to update'),
  }),
  options: z.object({
    boardId: z.string().describe('Board ID the chart belongs to'),
    body: z.string().describe('JSON string with updated chart configuration'),
  }),
  examples: [
    {
      args: { chartId: 'chart_abc123' },
      options: {
        boardId: 'board_abc123',
        body: '{"name":"Updated chart name"}',
      },
      description: 'Update a chart',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return updateChartRun(options.boardId, args.chartId, options.body)
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
