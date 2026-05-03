import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const importCmd = Cli.create('import', {
  description: 'Import commands — bulk import wallet addresses into your project',
})

// ── Import wallets ──

export interface ImportWalletsOptions {
  addresses: string
  writeKey: string
}

export function buildImportBody(options: ImportWalletsOptions) {
  let parsedAddresses: unknown
  try {
    parsedAddresses = JSON.parse(options.addresses)
    if (!Array.isArray(parsedAddresses)) {
      throw new Error('not an array')
    }
  } catch {
    throw new Error('--addresses must be a valid JSON array of wallet address strings')
  }
  return {
    addresses: parsedAddresses,
    writeKey: options.writeKey,
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
      .describe('JSON array of wallet address strings to import'),
    writeKey: z.string().describe('Project write SDK key'),
  }),
  examples: [
    {
      options: {
        addresses: '["0xabc…","0xdef…"]',
        writeKey: 'write_key_xxx',
      },
      description: 'Import two wallet addresses',
    },
  ],
  hint: 'Requires profiles:write scope. Only available on Scale and Enterprise plans.',
  run({ options }) {
    return importWalletsRun(options)
  },
})
