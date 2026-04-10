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
    patch: vi.fn(),
    delete: vi.fn(),
  }
  vi.mocked(createClient).mockReturnValue(mock as any)
  return mock
}

describe('alerts commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(requireApiKey).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listAlertsRun', () => {
    it('calls GET /v0/alerts/', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue([])

      const { listAlertsRun } = await import('./alerts')
      await listAlertsRun()

      expect(requireApiKey).toHaveBeenCalled()
      expect(client.get).toHaveBeenCalledWith('/v0/alerts/')
    })
  })

  describe('getAlertRun', () => {
    it('calls GET /v0/alerts/:alertId', async () => {
      const client = makeClientMock()
      client.get.mockResolvedValue({})

      const { getAlertRun } = await import('./alerts')
      await getAlertRun('alert_123')

      expect(client.get).toHaveBeenCalledWith('/v0/alerts/alert_123')
    })
  })

  describe('createAlertRun', () => {
    it('calls POST /v0/alerts/ with name and trigger_type', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createAlertRun } = await import('./alerts')
      await createAlertRun({ name: 'Test Alert', triggerType: 'event' })

      expect(client.post).toHaveBeenCalledWith('/v0/alerts/', {
        name: 'Test Alert',
        trigger_type: 'event',
      })
    })

    it('parses triggerFilters and recipient as JSON', async () => {
      const client = makeClientMock()
      client.post.mockResolvedValue({})

      const { createAlertRun } = await import('./alerts')
      await createAlertRun({
        name: 'Test',
        triggerType: 'event',
        triggerFilters: '[{"field":"amount","op":"gt","value":100}]',
        recipient: '["webhook_url"]',
      })

      expect(client.post).toHaveBeenCalledWith('/v0/alerts/', {
        name: 'Test',
        trigger_type: 'event',
        trigger_filters: [{ field: 'amount', op: 'gt', value: 100 }],
        recipient: ['webhook_url'],
      })
    })

    it('throws on invalid triggerFilters JSON', async () => {
      makeClientMock()

      const { createAlertRun } = await import('./alerts')
      expect(() =>
        createAlertRun({ name: 'Test', triggerType: 'event', triggerFilters: 'bad' }),
      ).toThrow('--triggerFilters must be a valid JSON array')
    })

    it('throws on invalid recipient JSON', async () => {
      makeClientMock()

      const { createAlertRun } = await import('./alerts')
      expect(() =>
        createAlertRun({ name: 'Test', triggerType: 'event', recipient: 'bad' }),
      ).toThrow('--recipient must be a valid JSON array')
    })
  })

  describe('updateAlertRun', () => {
    it('calls PUT /v0/alerts/:alertId', async () => {
      const client = makeClientMock()
      client.put.mockResolvedValue({})

      const { updateAlertRun } = await import('./alerts')
      await updateAlertRun('alert_123', { name: 'Updated', triggerType: 'threshold' })

      expect(client.put).toHaveBeenCalledWith('/v0/alerts/alert_123', {
        name: 'Updated',
        trigger_type: 'threshold',
      })
    })
  })

  describe('deleteAlertRun', () => {
    it('calls DELETE /v0/alerts/:alertId', async () => {
      const client = makeClientMock()
      client.delete.mockResolvedValue({})

      const { deleteAlertRun } = await import('./alerts')
      await deleteAlertRun('alert_123')

      expect(client.delete).toHaveBeenCalledWith('/v0/alerts/alert_123')
    })
  })

  describe('toggleAlertRun', () => {
    it('calls PATCH /v0/alerts/:alertId with status', async () => {
      const client = makeClientMock()
      client.patch.mockResolvedValue({})

      const { toggleAlertRun } = await import('./alerts')
      await toggleAlertRun('alert_123', 'paused')

      expect(client.patch).toHaveBeenCalledWith('/v0/alerts/alert_123', {
        status: 'paused',
      })
    })
  })

  describe('requireApiKey guard', () => {
    it('propagates requireApiKey error', async () => {
      makeClientMock()
      vi.mocked(requireApiKey).mockImplementation(() => {
        throw new Error('No API key configured')
      })

      const { listAlertsRun } = await import('./alerts')
      expect(() => listAlertsRun()).toThrow('No API key configured')
    })
  })
})
