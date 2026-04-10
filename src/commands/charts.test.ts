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
    put: vi.fn(),
    delete: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('charts commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listChartsRun', () => {
    it('calls GET /v0/boards/:boardId/charts/', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue([])

      const { listChartsRun } = await import('./charts')
      await listChartsRun('board_123')

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/boards/board_123/charts/')
    })
  })

  describe('getChartRun', () => {
    it('calls GET /v0/boards/:boardId/charts/:chartId', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getChartRun } = await import('./charts')
      await getChartRun('board_123', 'chart_456')

      expect(client.get).toHaveBeenCalledWith('/v0/boards/board_123/charts/chart_456')
    })
  })

  describe('createChartRun', () => {
    it('calls POST with parsed JSON body', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createChartRun } = await import('./charts')
      await createChartRun('board_123', '{"name":"DAU","chartType":"line"}')

      expect(client.post).toHaveBeenCalledWith('/v0/boards/board_123/charts/', {
        name: 'DAU',
        chartType: 'line',
      })
    })

    it('throws on invalid body JSON', async () => {
      makeClientMock()

      const { createChartRun } = await import('./charts')
      expect(() => createChartRun('board_123', 'not json')).toThrow(
        '--body must be valid JSON',
      )
    })
  })

  describe('updateChartRun', () => {
    it('calls PUT with parsed JSON body', async () => {
      const client = makeClientMock()
      client.put.mockResolvedValue({})

      const { updateChartRun } = await import('./charts')
      await updateChartRun('board_123', 'chart_456', '{"name":"Updated"}')

      expect(client.put).toHaveBeenCalledWith('/v0/boards/board_123/charts/chart_456', {
        name: 'Updated',
      })
    })

    it('throws on invalid body JSON', async () => {
      makeClientMock()

      const { updateChartRun } = await import('./charts')
      expect(() => updateChartRun('board_123', 'chart_456', 'bad')).toThrow(
        '--body must be valid JSON',
      )
    })
  })

  describe('deleteChartRun', () => {
    it('calls DELETE /v0/boards/:boardId/charts/:chartId', async () => {
      const client = makeClientMock()
      client.delete.mockResolvedValue({})

      const { deleteChartRun } = await import('./charts')
      await deleteChartRun('board_123', 'chart_456')

      expect(client.delete).toHaveBeenCalledWith('/v0/boards/board_123/charts/chart_456')
    })
  })

  describe('requireApiKey guard', () => {
    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { listChartsRun } = await import('./charts')
      expect(() => listChartsRun('board_123')).toThrow('No API key configured')
    })
  })
})
