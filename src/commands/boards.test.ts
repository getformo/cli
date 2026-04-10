import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/client', () => ({
  requireApiKey: vi.fn(),
  createClient: vi.fn(),
}))

import { requireApiKey, createClient } from '../lib/client'

function makeClientMock() {
  const mock = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('boards commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listBoardsRun', () => {
    it('calls GET /v0/boards/', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue([])

      const { listBoardsRun } = await import('./boards')
      await listBoardsRun()

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/boards/')
    })
  })

  describe('getBoardRun', () => {
    it('calls GET /v0/boards/:boardId', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getBoardRun } = await import('./boards')
      await getBoardRun('board_123')

      expect(client.get).toHaveBeenCalledWith('/v0/boards/board_123')
    })
  })

  describe('createBoardRun', () => {
    it('calls POST /v0/boards/ with name', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createBoardRun } = await import('./boards')
      await createBoardRun({ name: 'My Board' })

      expect(client.post).toHaveBeenCalledWith('/v0/boards/', { name: 'My Board' })
    })

    it('includes description when provided', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createBoardRun } = await import('./boards')
      await createBoardRun({ name: 'My Board', description: 'A description' })

      expect(client.post).toHaveBeenCalledWith('/v0/boards/', {
        name: 'My Board',
        description: 'A description',
      })
    })
  })

  describe('updateBoardRun', () => {
    it('calls PATCH /v0/boards/:boardId with updated fields', async () => {
      const client = makeClientMock()
      client.patch.mockResolvedValue({})

      const { updateBoardRun } = await import('./boards')
      await updateBoardRun('board_123', { name: 'Renamed' })

      expect(client.patch).toHaveBeenCalledWith('/v0/boards/board_123', {
        name: 'Renamed',
      })
    })

    it('sends empty body when no options provided', async () => {
      const client = makeClientMock()
      client.patch.mockResolvedValue({})

      const { updateBoardRun } = await import('./boards')
      await updateBoardRun('board_123', {})

      expect(client.patch).toHaveBeenCalledWith('/v0/boards/board_123', {})
    })
  })

  describe('deleteBoardRun', () => {
    it('calls DELETE /v0/boards/:boardId', async () => {
      const client = makeClientMock()
      client.delete.mockResolvedValue({})

      const { deleteBoardRun } = await import('./boards')
      await deleteBoardRun('board_123')

      expect(client.delete).toHaveBeenCalledWith('/v0/boards/board_123')
    })
  })

  describe('requireApiKey guard', () => {
    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { listBoardsRun } = await import('./boards')
      expect(() => listBoardsRun()).toThrow('No API key configured')
    })
  })
})
