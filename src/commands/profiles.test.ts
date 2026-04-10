import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/client', () => ({
  requireApiKey: vi.fn(),
  createClient: vi.fn(),
}))

import { requireApiKey, createClient } from '../lib/client'

function makeClientMock() {
  const mock = {
    get: vi.fn(),
    request: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('profiles commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProfileRun', () => {
    it('calls GET /v0/profiles/:address with no params', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({ address: '0xabc' })

      const { getProfileRun } = await import('./profiles')
      await getProfileRun('0xabc')

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/profiles/0xabc', { params: {} })
    })

    it('encodes special characters in address', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getProfileRun } = await import('./profiles')
      await getProfileRun('vitalik.eth')

      expect(client.get).toHaveBeenCalledWith('/v0/profiles/vitalik.eth', { params: {} })
    })

    it('passes expand as query param when provided', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getProfileRun } = await import('./profiles')
      await getProfileRun('0xabc', 'labels,chains')

      expect(client.get).toHaveBeenCalledWith('/v0/profiles/0xabc', {
        params: { expand: 'labels,chains' },
      })
    })

    it('omits expand param when not provided', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getProfileRun } = await import('./profiles')
      await getProfileRun('0xabc', undefined)

      expect(client.get).toHaveBeenCalledWith('/v0/profiles/0xabc', { params: {} })
    })

    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { getProfileRun } = await import('./profiles')
      expect(() => getProfileRun('0xabc')).toThrow('No API key configured')
    })
  })

  describe('searchProfilesRun', () => {
    it('calls GET /v0/profiles/ with no params by default', async () => {
      const client = makeClientMock()
      client.request.mockResolvedValue([])

      const { searchProfilesRun } = await import('./profiles')
      await searchProfilesRun({})

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/v0/profiles/',
        params: {},
        data: undefined,
      })
    })

    it('passes limit and orderBy/orderDir as params', async () => {
      const client = makeClientMock()
      client.request.mockResolvedValue([])

      const { searchProfilesRun } = await import('./profiles')
      await searchProfilesRun({ limit: 10, orderBy: 'net_worth_usd', orderDir: 'desc' })

      expect(client.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/v0/profiles/',
        params: { limit: 10, order_by: 'net_worth_usd', order_dir: 'desc' },
        data: undefined,
      })
    })

    it('passes address and offset as params', async () => {
      const client = makeClientMock()
      client.request.mockResolvedValue([])

      const { searchProfilesRun } = await import('./profiles')
      await searchProfilesRun({ address: '0xabc', offset: 20 })

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ params: { address: '0xabc', offset: 20 } }),
      )
    })

    it('parses valid conditions JSON and defaults logic to "and"', async () => {
      const client = makeClientMock()
      client.request.mockResolvedValue([])

      const { searchProfilesRun } = await import('./profiles')
      const conditions = '[{"field":"net_worth_usd","op":"gt","value":10000}]'
      await searchProfilesRun({ conditions })

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            conditions: [{ field: 'net_worth_usd', op: 'gt', value: 10000 }],
            logic: 'and',
          },
        }),
      )
    })

    it('sends logic "or" when --logic or is provided', async () => {
      const client = makeClientMock()
      client.request.mockResolvedValue([])

      const { searchProfilesRun } = await import('./profiles')
      const conditions = '[{"field":"net_worth_usd","op":"gt","value":10000}]'
      await searchProfilesRun({ conditions, logic: 'or' })

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            conditions: [{ field: 'net_worth_usd', op: 'gt', value: 10000 }],
            logic: 'or',
          },
        }),
      )
    })

    it('throws on invalid conditions JSON', async () => {
      makeClientMock()

      const { searchProfilesRun } = await import('./profiles')
      expect(() => searchProfilesRun({ conditions: 'not valid json' })).toThrow(
        '--conditions must be valid JSON array of FilterCondition objects',
      )
    })

    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { searchProfilesRun } = await import('./profiles')
      expect(() => searchProfilesRun({})).toThrow('No API key configured')
    })
  })
})
