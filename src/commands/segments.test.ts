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
    delete: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('segments commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listSegmentsRun', () => {
    it('calls GET /v0/segments/', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue([])

      const { listSegmentsRun } = await import('./segments')
      await listSegmentsRun()

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/segments/')
    })
  })

  describe('createSegmentRun', () => {
    it('calls POST /v0/segments/ with title and parsed filterSets', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createSegmentRun } = await import('./segments')
      await createSegmentRun({
        title: 'Whales',
        filterSets: '["net_worth_usd > 100000"]',
      })

      expect(client.post).toHaveBeenCalledWith('/v0/segments/', {
        title: 'Whales',
        filterSets: ['net_worth_usd > 100000'],
      })
    })

    it('throws on invalid filterSets JSON', async () => {
      makeClientMock()

      const { createSegmentRun } = await import('./segments')
      expect(() =>
        createSegmentRun({ title: 'Bad', filterSets: 'not json' }),
      ).toThrow('--filterSets must be a valid JSON array')
    })
  })

  describe('deleteSegmentRun', () => {
    it('calls DELETE /v0/segments/:segmentId', async () => {
      const client = makeClientMock()
      client.delete.mockResolvedValue({})

      const { deleteSegmentRun } = await import('./segments')
      await deleteSegmentRun('seg_123')

      expect(client.delete).toHaveBeenCalledWith('/v0/segments/seg_123')
    })
  })

  describe('requireApiKey guard', () => {
    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { listSegmentsRun } = await import('./segments')
      expect(() => listSegmentsRun()).toThrow('No API key configured')
    })
  })
})
