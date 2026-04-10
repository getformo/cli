import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

vi.mock('fs')

const mockFs = vi.mocked(fs)

describe('config', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.FORMO_API_KEY
  })

  afterEach(() => {
    delete process.env.FORMO_API_KEY
  })

  describe('readConfig', () => {
    it('returns {} when file is missing', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT')
      })
      const { readConfig } = await import('./config')
      expect(readConfig()).toEqual({})
    })

    it('parses and returns file contents when present', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'formo_test' }))
      const { readConfig } = await import('./config')
      expect(readConfig()).toEqual({ apiKey: 'formo_test' })
    })
  })

  describe('saveConfig', () => {
    it('merges with existing config and writes to file', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'formo_old' }))
      mockFs.mkdirSync.mockImplementation(() => undefined)
      mockFs.writeFileSync.mockImplementation(() => undefined)

      const { saveConfig } = await import('./config')
      saveConfig({ apiKey: 'formo_new' })

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        JSON.stringify({ apiKey: 'formo_new' }, null, 2),
        { mode: 0o600 },
      )
    })
  })

  describe('getApiKey', () => {
    it('returns FORMO_API_KEY env var when set', async () => {
      process.env.FORMO_API_KEY = 'env_key'
      const { getApiKey } = await import('./config')
      expect(getApiKey()).toBe('env_key')
    })

    it('returns file api key when env var is not set', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'file_key' }))
      const { getApiKey } = await import('./config')
      expect(getApiKey()).toBe('file_key')
    })
  })
})
