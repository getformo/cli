import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/client', () => ({
  requireApiKey: vi.fn(),
  createClient: vi.fn(),
}))

import { requireApiKey, createClient } from '../lib/client'

function makeClientMock() {
  const mock = {
    post: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('import commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('importWalletsRun', () => {
    it('calls POST /v0/import/ with parsed addresses and writeKey', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { importWalletsRun } = await import('./import')
      await importWalletsRun({
        addresses: '["0xabc","0xdef"]',
        writeKey: 'write_key_xxx',
      })

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.post).toHaveBeenCalledWith('/v0/import/', {
        addresses: ['0xabc', '0xdef'],
        writeKey: 'write_key_xxx',
      })
    })

    it('throws on invalid addresses JSON', async () => {
      makeClientMock()

      const { importWalletsRun } = await import('./import')
      expect(() =>
        importWalletsRun({ addresses: 'not json', writeKey: 'key' }),
      ).toThrow('--addresses must be a valid JSON array of wallet address strings')
    })

    it('throws when addresses is not an array', async () => {
      makeClientMock()

      const { importWalletsRun } = await import('./import')
      expect(() =>
        importWalletsRun({ addresses: '{"addr":"0xabc"}', writeKey: 'key' }),
      ).toThrow('--addresses must be a valid JSON array of wallet address strings')
    })

    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { importWalletsRun } = await import('./import')
      expect(() =>
        importWalletsRun({ addresses: '["0xabc"]', writeKey: 'key' }),
      ).toThrow('No API key configured')
    })
  })
})
