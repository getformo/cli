import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import { parseJsonArray, parseJsonArrayOfObjects } from '../lib/json'

export const importCmd = Cli.create('import', {
  description: 'Import commands — bulk import wallet addresses into your project',
})

// ── Import wallets ──

export interface ImportWalletsOptions {
  addresses?: string
  rows?: string
  writeKey?: string
}

export function buildImportBody(options: ImportWalletsOptions) {
  if (options.rows && options.addresses) {
    throw new Error('Provide only one of --addresses or --rows')
  }

  if (options.rows) {
    const rows = parseJsonArrayOfObjects(options.rows, '--rows')
    const addresses = rows.map((row) => row.address)
    if (addresses.some((address) => typeof address !== 'string' || !address)) {
      throw new Error('--rows entries must each include a non-empty string address')
    }
    return {
      addresses,
      rows,
    }
  }

  if (!options.addresses) {
    throw new Error('Provide --addresses or --rows')
  }

  const addresses = parseJsonArray(options.addresses, '--addresses')
  if (addresses.some((address) => typeof address !== 'string' || !address)) {
    throw new Error('--addresses must be a JSON array of wallet address strings')
  }

  return {
    addresses,
  }
}

export function importWalletsRun(options: ImportWalletsOptions) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/import/', buildImportBody(options))
}

importCmd.command('wallets', {
  description: 'Bulk import wallet addresses into the project',
  options: z.object({
    addresses: z
      .string()
      .optional()
      .describe('JSON array of wallet address strings to import'),
    rows: z
      .string()
      .optional()
      .describe('JSON array of {address,properties?} objects for imports with profile properties'),
    writeKey: z
      .string()
      .optional()
      .describe('Deprecated; import now uses the project write key server-side')
      .meta({ deprecated: true }),
  }),
  examples: [
    {
      options: {
        addresses: '["0xabc…","0xdef…"]',
      },
      description: 'Import two wallet addresses',
    },
    {
      options: {
        rows: '[{"address":"0xabc…","properties":{"display_name":"Alice"}}]',
      },
      description: 'Import wallets with profile properties',
    },
  ],
  hint: 'Requires profiles:write scope. Only available on Scale and Enterprise plans.',
  run({ options }) {
    return importWalletsRun(options)
  },
})
