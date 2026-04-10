import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./config', () => ({
  getApiKey: vi.fn(),
}))

import { getApiKey } from './config'

describe('client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('requireApiKey', () => {
    it('throws when no API key is configured', async () => {
      vi.mocked(getApiKey).mockReturnValue(undefined)
      const { requireApiKey } = await import('./client')
      expect(() => requireApiKey()).toThrow('No API key configured')
    })

    it('does not throw when FORMO_API_KEY is set', async () => {
      vi.mocked(getApiKey).mockReturnValue('formo_test')
      const { requireApiKey } = await import('./client')
      expect(() => requireApiKey()).not.toThrow()
    })
  })

  describe('createClient', () => {
    it('sets Authorization header when api key is present', async () => {
      vi.mocked(getApiKey).mockReturnValue('formo_abc')
      const { createClient } = await import('./client')
      const client = createClient()
      const headers = client.defaults.headers as Record<string, unknown>
      const common = headers['common'] as Record<string, unknown> | undefined
      expect(headers['Authorization'] ?? common?.['Authorization']).toBe('Bearer formo_abc')
    })

    it('omits Authorization header when no api key', async () => {
      vi.mocked(getApiKey).mockReturnValue(undefined)
      const { createClient } = await import('./client')
      const client = createClient()
      const headers = client.defaults.headers as Record<string, unknown>
      const common = headers['common'] as Record<string, unknown> | undefined
      expect(headers['Authorization'] ?? common?.['Authorization']).toBeUndefined()
    })
  })
})
