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

describe('contracts commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listContractsRun', () => {
    it('calls GET /v0/contracts/', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue([])

      const { listContractsRun } = await import('./contracts')
      await listContractsRun()

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/contracts/')
    })
  })

  describe('createContractRun', () => {
    it('calls POST /v0/contracts/ with parsed ABI and events', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createContractRun } = await import('./contracts')
      await createContractRun({
        address: '0xabc',
        chain: 1,
        name: 'Token',
        abi: '[{"type":"event","name":"Transfer"}]',
        events: '{"Transfer":true}',
      })

      expect(client.post).toHaveBeenCalledWith('/v0/contracts/', {
        address: '0xabc',
        chain: 1,
        name: 'Token',
        abi: [{ type: 'event', name: 'Transfer' }],
        events: { Transfer: true },
      })
    })

    it('throws on invalid ABI JSON', async () => {
      makeClientMock()

      const { createContractRun } = await import('./contracts')
      expect(() =>
        createContractRun({
          address: '0xabc',
          chain: 1,
          name: 'Token',
          abi: 'bad',
          events: '{}',
        }),
      ).toThrow('--abi must be a valid JSON array')
    })

    it('throws on invalid events JSON', async () => {
      makeClientMock()

      const { createContractRun } = await import('./contracts')
      expect(() =>
        createContractRun({
          address: '0xabc',
          chain: 1,
          name: 'Token',
          abi: '[]',
          events: 'bad',
        }),
      ).toThrow('--events must be valid JSON')
    })
  })

  describe('updateContractRun', () => {
    it('calls PUT /v0/contracts/:chain/:address with parsed body', async () => {
      const client = makeClientMock()
      client.put.mockResolvedValue({})

      const { updateContractRun } = await import('./contracts')
      await updateContractRun('1', '0xabc', {
        name: 'Updated',
        abi: '[]',
        events: '{}',
      })

      expect(client.put).toHaveBeenCalledWith('/v0/contracts/1/0xabc', {
        name: 'Updated',
        abi: [],
        events: {},
      })
    })

    it('throws on invalid ABI JSON', async () => {
      makeClientMock()

      const { updateContractRun } = await import('./contracts')
      expect(() =>
        updateContractRun('1', '0xabc', { name: 'X', abi: 'bad', events: '{}' }),
      ).toThrow('--abi must be a valid JSON array')
    })

    it('throws on invalid events JSON', async () => {
      makeClientMock()

      const { updateContractRun } = await import('./contracts')
      expect(() =>
        updateContractRun('1', '0xabc', { name: 'X', abi: '[]', events: 'bad' }),
      ).toThrow('--events must be valid JSON')
    })
  })

  describe('deleteContractRun', () => {
    it('calls DELETE /v0/contracts/:chain/:address', async () => {
      const client = makeClientMock()
      client.delete.mockResolvedValue({})

      const { deleteContractRun } = await import('./contracts')
      await deleteContractRun('1', '0xabc')

      expect(client.delete).toHaveBeenCalledWith('/v0/contracts/1/0xabc')
    })
  })

  describe('requireApiKey guard', () => {
    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { listContractsRun } = await import('./contracts')
      expect(() => listContractsRun()).toThrow('No API key configured')
    })
  })
})
