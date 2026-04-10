import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const alerts = Cli.create('alerts', {
  description: 'Project alert commands — create, list, update, and delete alerts',
})

// ── List alerts ──

export function listAlertsRun() {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/alerts/')
}

alerts.command('list', {
  description: 'List all alerts for the project',
  examples: [{ description: 'List all project alerts' }],
  hint: 'Requires alerts:read scope on your API key.',
  run() {
    return listAlertsRun()
  },
})

// ── Get a single alert ──

export function getAlertRun(alertId: string) {
  requireApiKey()
  const client = createClient()
  return client.get(`/v0/alerts/${encodeURIComponent(alertId)}`)
}

alerts.command('get', {
  description: 'Get a single alert by ID',
  args: z.object({
    alertId: z.string().describe('Alert ID'),
  }),
  examples: [
    { args: { alertId: 'alert_abc123' }, description: 'Get alert details' },
  ],
  hint: 'Requires alerts:read scope on your API key.',
  run({ args }) {
    return getAlertRun(args.alertId)
  },
})

// ── Create an alert ──

export interface CreateAlertOptions {
  name: string
  triggerType: string
  triggerFilters?: string
  recipient?: string
  secret?: string
}

export function createAlertRun(options: CreateAlertOptions) {
  requireApiKey()
  const client = createClient()

  const body: Record<string, unknown> = {
    name: options.name,
    trigger_type: options.triggerType,
  }

  if (options.triggerFilters) {
    try {
      body.trigger_filters = JSON.parse(options.triggerFilters)
    } catch {
      throw new Error('--triggerFilters must be a valid JSON array')
    }
  }

  if (options.recipient) {
    try {
      body.recipient = JSON.parse(options.recipient)
    } catch {
      throw new Error('--recipient must be a valid JSON array')
    }
  }

  if (options.secret) {
    body.secret = options.secret
  }

  return client.post('/v0/alerts/', body)
}

alerts.command('create', {
  description: 'Create a new project alert',
  options: z.object({
    name: z.string().describe('Alert name'),
    triggerType: z.string().describe('Trigger type (e.g. "event", "threshold")'),
    triggerFilters: z
      .string()
      .optional()
      .describe('JSON array of trigger filter objects'),
    recipient: z
      .string()
      .optional()
      .describe('JSON array of recipient objects'),
    secret: z.string().optional().describe('Webhook secret for the alert'),
  }),
  examples: [
    {
      options: { name: 'High value tx', triggerType: 'event' },
      description: 'Create a basic event alert',
    },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ options }) {
    return createAlertRun(options)
  },
})

// ── Update an alert ──

export interface UpdateAlertOptions {
  name: string
  triggerType: string
  triggerFilters?: string
  recipient?: string
  secret?: string
}

export function updateAlertRun(alertId: string, options: UpdateAlertOptions) {
  requireApiKey()
  const client = createClient()

  const body: Record<string, unknown> = {
    name: options.name,
    trigger_type: options.triggerType,
  }

  if (options.triggerFilters) {
    try {
      body.trigger_filters = JSON.parse(options.triggerFilters)
    } catch {
      throw new Error('--triggerFilters must be a valid JSON array')
    }
  }

  if (options.recipient) {
    try {
      body.recipient = JSON.parse(options.recipient)
    } catch {
      throw new Error('--recipient must be a valid JSON array')
    }
  }

  if (options.secret !== undefined) {
    body.secret = options.secret
  }

  return client.put(`/v0/alerts/${encodeURIComponent(alertId)}`, body)
}

alerts.command('update', {
  description: 'Update an existing alert',
  args: z.object({
    alertId: z.string().describe('Alert ID to update'),
  }),
  options: z.object({
    name: z.string().describe('Alert name'),
    triggerType: z.string().describe('Trigger type'),
    triggerFilters: z
      .string()
      .optional()
      .describe('JSON array of trigger filter objects'),
    recipient: z
      .string()
      .optional()
      .describe('JSON array of recipient objects'),
    secret: z.string().optional().describe('Webhook secret for the alert'),
  }),
  examples: [
    {
      args: { alertId: 'alert_abc123' },
      options: { name: 'Renamed alert', triggerType: 'event' },
      description: 'Update alert name',
    },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ args, options }) {
    return updateAlertRun(args.alertId, options)
  },
})

// ── Delete an alert ──

export function deleteAlertRun(alertId: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(`/v0/alerts/${encodeURIComponent(alertId)}`)
}

alerts.command('delete', {
  description: 'Delete an alert',
  args: z.object({
    alertId: z.string().describe('Alert ID to delete'),
  }),
  examples: [
    { args: { alertId: 'alert_abc123' }, description: 'Delete an alert' },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ args }) {
    return deleteAlertRun(args.alertId)
  },
})

// ── Toggle alert status ──

export function toggleAlertRun(alertId: string, status: string) {
  requireApiKey()
  const client = createClient()
  return client.patch(`/v0/alerts/${encodeURIComponent(alertId)}`, { status })
}

alerts.command('toggle', {
  description: 'Toggle an alert status (active/paused)',
  args: z.object({
    alertId: z.string().describe('Alert ID to toggle'),
  }),
  options: z.object({
    status: z.enum(['active', 'paused']).describe('New status'),
  }),
  examples: [
    {
      args: { alertId: 'alert_abc123' },
      options: { status: 'paused' },
      description: 'Pause an alert',
    },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ args, options }) {
    return toggleAlertRun(args.alertId, options.status)
  },
})
