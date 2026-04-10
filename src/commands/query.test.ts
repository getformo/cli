import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/client', () => ({
  requireApiKey: vi.fn(),
  createClient: vi.fn(),
}))

import { requireApiKey, createClient } from '../lib/client'

describe('query commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('queryRunRun', () => {
    it('calls POST /v0/query/ with { query: sql }', async () => {
      const postMock = vi.fn().mockResolvedValue({ rows: [] })
      vi.mocked(createClient).mockReturnValue({ post: postMock } as any)

      const { queryRunRun } = await import('./query')
      const sql = 'SELECT count(*) FROM events'
      await queryRunRun(sql)

      expect(requireApiKey).toHaveBeenCalled()
      expect(postMock).toHaveBeenCalledWith('/v0/query/', { query: sql })
    })

    it('passes arbitrary SQL through unmodified', async () => {
      const postMock = vi.fn().mockResolvedValue({ rows: [] })
      vi.mocked(createClient).mockReturnValue({ post: postMock } as any)

      const { queryRunRun } = await import('./query')
      const sql = 'SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10'
      await queryRunRun(sql)

      expect(postMock).toHaveBeenCalledWith('/v0/query/', { query: sql })
    })

    it('propagates requireApiKey error', async () => {
      vi.mocked(createClient).mockReturnValue({ post: vi.fn() } as any)
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured. Run `formo login <apiKey>` or set FORMO_API_KEY env var.')
      })

      const { queryRunRun } = await import('./query')
      expect(() => queryRunRun('SELECT 1')).toThrow('No API key configured')
    })

    it('propagates API errors from client.post', async () => {
      const postMock = vi.fn().mockRejectedValue(new Error('Unauthorized'))
      vi.mocked(createClient).mockReturnValue({ post: postMock } as any)

      const { queryRunRun } = await import('./query')
      await expect(queryRunRun('SELECT 1')).rejects.toThrow('Unauthorized')
    })
  })
})
