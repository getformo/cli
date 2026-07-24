import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import {
  buildPaginationParams,
  paginationOptionsSchema,
  type PaginationOptions,
} from '../lib/pagination'

export type { PaginationOptions }

export const boards = Cli.create('boards', {
  description: 'Dashboard board commands — create, list, update, and delete boards',
})

// ── List boards ──

export function listBoardsRun(options: PaginationOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/boards/', { params: buildPaginationParams(options) })
}

boards.command('list', {
  description: 'List all boards for the project',
  options: z.object(paginationOptionsSchema),
  examples: [{ description: 'List all dashboard boards' }],
  hint: 'Requires boards:read scope on your API key.',
  run({ options }) {
    return listBoardsRun(options)
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
  title?: string
  name?: string
  description?: string
  isPublic?: boolean
}

export function buildBoardBody(options: CreateBoardOptions | UpdateBoardOptions) {
  const title = options.title ?? options.name
  const body: Record<string, unknown> = {}
  if (title !== undefined) {
    if (!title) throw new Error('--title (or its deprecated alias --name) must not be empty')
    body.title = title
  }
  if (options.description !== undefined) {
    body.description = options.description
  }
  if (options.isPublic !== undefined) {
    body.isPublic = options.isPublic
  }

  return body
}

export function createBoardRun(options: CreateBoardOptions) {
  requireApiKey()
  const client = createClient()

  const body = buildBoardBody(options)
  if (!body.title) {
    throw new Error('Provide --title for the board name')
  }

  return client.post('/v0/boards/', body)
}

boards.command('create', {
  description: 'Create a new dashboard board',
  options: z.object({
    title: z.string().optional().describe('Board title'),
    name: z.string().optional().describe('Deprecated alias for --title').meta({ deprecated: true }),
    description: z.string().optional().describe('Board description'),
    isPublic: z.boolean().optional().describe('Whether the board is publicly viewable'),
  }),
  examples: [
    {
      options: { title: 'KPI Dashboard' },
      description: 'Create a board',
    },
    {
      options: { title: 'Revenue Metrics', description: 'Weekly revenue tracking' },
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
  title?: string
  name?: string
  description?: string
  isPublic?: boolean
}

export function updateBoardRun(boardId: string, options: UpdateBoardOptions) {
  requireApiKey()
  const client = createClient()

  const body = buildBoardBody(options)
  if (Object.keys(body).length === 0) {
    throw new Error('Provide at least one of --title, --description, or --is-public')
  }

  return client.patch(`/v0/boards/${encodeURIComponent(boardId)}`, body)
}

boards.command('update', {
  description: 'Update an existing board',
  args: z.object({
    boardId: z.string().describe('Board ID to update'),
  }),
  options: z.object({
    title: z.string().optional().describe('New board title'),
    name: z.string().optional().describe('Deprecated alias for --title').meta({ deprecated: true }),
    description: z.string().optional().describe('New board description'),
    isPublic: z.boolean().optional().describe('Whether the board is publicly viewable'),
  }),
  examples: [
    {
      args: { boardId: 'board_abc123' },
      options: { title: 'Renamed Board' },
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
