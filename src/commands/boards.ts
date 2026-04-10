import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const boards = Cli.create('boards', {
  description: 'Dashboard board commands — create, list, update, and delete boards',
})

// ── List boards ──

export function listBoardsRun() {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/boards/')
}

boards.command('list', {
  description: 'List all boards for the project',
  examples: [{ description: 'List all dashboard boards' }],
  hint: 'Requires boards:read scope on your API key.',
  run() {
    return listBoardsRun()
  },
})

// ── Get a single board ──

export function getBoardRun(boardId: string) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/boards/${encodeURIComponent(boardId)}`)
}

boards.command('get', {
  description: 'Get a single board by ID',
  args: z.object({
    boardId: z.string().describe('Board ID'),
  }),
  examples: [
    { args: { boardId: 'board_abc123' }, description: 'Get board details' },
  ],
  hint: 'Requires boards:read scope on your API key.',
  run({ args }) {
    return getBoardRun(args.boardId)
  },
})

// ── Create a board ──

export interface CreateBoardOptions {
  name: string
  description?: string
}

export function createBoardRun(options: CreateBoardOptions) {
  requireApiKey()
  const client = createClient()

  const body: Record<string, unknown> = { name: options.name }
  if (options.description) {
    body.description = options.description
  }

  return client.post('/v0/boards/', body)
}

boards.command('create', {
  description: 'Create a new dashboard board',
  options: z.object({
    name: z.string().describe('Board name'),
    description: z.string().optional().describe('Board description'),
  }),
  examples: [
    {
      options: { name: 'KPI Dashboard' },
      description: 'Create a board',
    },
    {
      options: { name: 'Revenue Metrics', description: 'Weekly revenue tracking' },
      description: 'Create a board with description',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ options }) {
    return createBoardRun(options)
  },
})

// ── Update a board ──

export interface UpdateBoardOptions {
  name?: string
  description?: string
}

export function updateBoardRun(boardId: string, options: UpdateBoardOptions) {
  requireApiKey()
  const client = createClient()

  const body: Record<string, unknown> = {}
  if (options.name !== undefined) body.name = options.name
  if (options.description !== undefined) body.description = options.description

  return client.patch(`/v0/boards/${encodeURIComponent(boardId)}`, body)
}

boards.command('update', {
  description: 'Update an existing board',
  args: z.object({
    boardId: z.string().describe('Board ID to update'),
  }),
  options: z.object({
    name: z.string().optional().describe('New board name'),
    description: z.string().optional().describe('New board description'),
  }),
  examples: [
    {
      args: { boardId: 'board_abc123' },
      options: { name: 'Renamed Board' },
      description: 'Rename a board',
    },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args, options }) {
    return updateBoardRun(args.boardId, options)
  },
})

// ── Delete a board ──

export function deleteBoardRun(boardId: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(`/v0/boards/${encodeURIComponent(boardId)}`)
}

boards.command('delete', {
  description: 'Delete a board',
  args: z.object({
    boardId: z.string().describe('Board ID to delete'),
  }),
  examples: [
    { args: { boardId: 'board_abc123' }, description: 'Delete a board' },
  ],
  hint: 'Requires boards:write scope on your API key.',
  run({ args }) {
    return deleteBoardRun(args.boardId)
  },
})
