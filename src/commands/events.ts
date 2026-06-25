import { Cli, z } from 'incur'
import { createEventsClient } from '../lib/client'
import { parseJsonArrayOfObjects, parseJsonObject } from '../lib/json'

export const events = Cli.create('events', {
  description: 'Event ingestion commands — send raw analytics events with a project SDK write key',
})

export interface IngestEventsOptions {
  events?: string
  event?: string
  writeKey?: string
}

function getWriteKey(options: IngestEventsOptions) {
  return options.writeKey ?? process.env.FORMO_WRITE_KEY
}

export function buildIngestEventsBody(options: IngestEventsOptions) {
  if (options.events) {
    const events = parseJsonArrayOfObjects(options.events, '--events')
    if (events.length === 0) {
      throw new Error('--events must contain at least one event')
    }
    return events
  }

  if (options.event) {
    return [parseJsonObject(options.event, '--event')]
  }

  throw new Error('Provide --event or --events')
}

export function ingestEventsRun(options: IngestEventsOptions) {
  const writeKey = getWriteKey(options)
  if (!writeKey) {
    throw new Error(
      'No event write key configured. Pass --write-key or set FORMO_WRITE_KEY.',
    )
  }
  const client = createEventsClient(writeKey)
  return client.post('/v0/raw_events', buildIngestEventsBody(options))
}

events.command('ingest', {
  description: 'Send one or more raw events to the Formo events API',
  options: z.object({
    event: z
      .string()
      .optional()
      .describe('Single event as a JSON object; wrapped in an array before sending'),
    events: z
      .string()
      .optional()
      .describe('JSON array of event objects to send'),
    writeKey: z
      .string()
      .optional()
      .describe('Project SDK write key. Defaults to FORMO_WRITE_KEY.'),
  }),
  examples: [
    {
      options: {
        event:
          '{"type":"track","channel":"cli","version":"1","anonymous_id":"anon_123","address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","event":"CLI Test","context":{},"properties":{},"original_timestamp":"2026-04-27T23:05:38.000Z","sent_at":"2026-04-27T23:05:42.000Z","message_id":"cli-test-1"}',
      },
      description: 'Send one custom event using FORMO_WRITE_KEY',
    },
  ],
  hint: 'Uses the events.formo.so API and requires a project SDK write key, not a workspace API key.',
  run({ options }) {
    return ingestEventsRun(options)
  },
})
