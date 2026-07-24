import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import { parseJsonArray, parseJsonObject } from '../lib/json'
import {
  buildPaginationParams,
  paginationOptionsSchema,
  type PaginationOptions,
} from '../lib/pagination'

export type { PaginationOptions }

export const alerts = Cli.create('alerts', {
  description: 'Project alert commands — create, list, update, and delete alerts',
})

// ── List alerts ──

export function listAlertsRun(options: PaginationOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/alerts/', { params: buildPaginationParams(options) })
}

alerts.command('list', {
  description: 'List all alerts for the project',
  options: z.object(paginationOptionsSchema),
  examples: [{ description: 'List all project alerts' }],
  hint: 'Requires alerts:read scope on your API key.',
  run({ options }) {
    return listAlertsRun(options)
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

export interface AlertBodyOptions {
  name: string
  triggerType: string
  triggerFilters?: string
  recipient?: string
  secret?: string
  slackPropertyKeys?: string
}

// Aliases kept for existing importers; create and update take the same body.
export type CreateAlertOptions = AlertBodyOptions
export type UpdateAlertOptions = AlertBodyOptions

// Shared option fragment for `create` and `update` (same PUT/POST body).
const alertBodyOptionsSchema = {
  name: z.string().describe('Alert name'),
  triggerType: z.enum(['event', 'user']).describe('Trigger type'),
  triggerFilters: z
    .string()
    .optional()
    .describe('JSON array of trigger filter objects'),
  recipient: z
    .string()
    .optional()
    .describe('JSON array of recipient objects'),
  secret: z.string().optional().describe('Webhook secret for the alert'),
  slackPropertyKeys: z
    .string()
    .optional()
    .describe('JSON array of event/user property keys to include in Slack alerts'),
}

export function buildAlertBody(options: AlertBodyOptions) {
  const body: Record<string, unknown> = {
    name: options.name,
    trigger_type: options.triggerType,
    trigger_filters: [],
  }

  if (options.triggerFilters) {
    body.trigger_filters = parseJsonArray(
      options.triggerFilters,
      '--trigger-filters',
    )
  }

  if (options.recipient) {
    body.recipient = parseJsonArray(options.recipient, '--recipient')
  }

  if (options.secret !== undefined) {
    body.secret = options.secret
  }

  if (options.slackPropertyKeys !== undefined) {
    body.slack_property_keys = parseJsonArray(
      options.slackPropertyKeys,
      '--slack-property-keys',
    )
  }

  return body
}

export function createAlertRun(options: CreateAlertOptions) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/alerts/', buildAlertBody(options))
}

alerts.command('create', {
  description: 'Create a new project alert',
  options: z.object(alertBodyOptionsSchema),
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

export function updateAlertRun(alertId: string, options: AlertBodyOptions) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/alerts/${encodeURIComponent(alertId)}`,
    buildAlertBody(options),
  )
}

alerts.command('update', {
  description:
    'Update an existing alert (full replace — omitted options reset to defaults)',
  args: z.object({
    alertId: z.string().describe('Alert ID to update'),
  }),
  options: z.object(alertBodyOptionsSchema),
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
  const normalizedStatus = status === 'paused' ? 'inactive' : status
  return client.patch(`/v0/alerts/${encodeURIComponent(alertId)}`, {
    status: normalizedStatus,
  })
}

alerts.command('toggle', {
  description: 'Toggle an alert status (active/inactive)',
  args: z.object({
    alertId: z.string().describe('Alert ID to toggle'),
  }),
  options: z.object({
    status: z.enum(['active', 'inactive', 'paused']).describe('New status. "paused" is accepted as a deprecated alias for "inactive".'),
  }),
  examples: [
    {
      args: { alertId: 'alert_abc123' },
      options: { status: 'inactive' },
      description: 'Deactivate an alert',
    },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ args, options }) {
    return toggleAlertRun(args.alertId, options.status)
  },
})

// ── Test alert delivery ──

export interface TestAlertOptions {
  sampleEvent?: string
  sampleUser?: string
  recipientOverrides?: string
}

export function buildTestAlertBody(options: TestAlertOptions) {
  const body: Record<string, unknown> = {}
  if (options.sampleEvent !== undefined) {
    body.sampleEvent = parseJsonObject(options.sampleEvent, '--sample-event')
  }
  if (options.sampleUser !== undefined) {
    body.sampleUser = parseJsonObject(options.sampleUser, '--sample-user')
  }
  if (options.recipientOverrides !== undefined) {
    body.recipientOverrides = parseJsonArray(
      options.recipientOverrides,
      '--recipient-overrides',
    )
  }
  return Object.keys(body).length > 0 ? body : undefined
}

export function testAlertRun(alertId: string, options: TestAlertOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.post(
    `/v0/alerts/${encodeURIComponent(alertId)}/test`,
    buildTestAlertBody(options),
  )
}

alerts.command('test', {
  description: 'Send a test delivery for an alert',
  args: z.object({
    alertId: z.string().describe('Alert ID to test'),
  }),
  options: z.object({
    sampleEvent: z
      .string()
      .optional()
      .describe('Optional JSON object to use as the sample event'),
    sampleUser: z
      .string()
      .optional()
      .describe('Optional JSON object to use as the sample user/profile'),
    recipientOverrides: z
      .string()
      .optional()
      .describe('Optional JSON array of recipient objects to test instead of saved recipients'),
  }),
  examples: [
    {
      args: { alertId: 'alert_abc123' },
      options: {
        sampleEvent: '{"event":"transaction","revenue":250}',
      },
      description: 'Send a test alert with a sample event',
    },
  ],
  hint: 'Requires alerts:write scope on your API key.',
  run({ args, options }) {
    return testAlertRun(args.alertId, options)
  },
})
