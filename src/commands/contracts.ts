import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const contracts = Cli.create('contracts', {
  description: 'Smart contract commands — register, list, update, and remove tracked contracts',
})

// ── List contracts ──

export function listContractsRun() {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/contracts/')
}

contracts.command('list', {
  description: 'List all tracked contracts for the project',
  examples: [{ description: 'List all project contracts' }],
  hint: 'Requires contracts:read scope on your API key.',
  run() {
    return listContractsRun()
  },
})

// ── Create a contract ──

export interface CreateContractOptions {
  address: string
  chain: number
  name: string
  abi: string
  events: string
}

export function buildCreateContractBody(options: CreateContractOptions) {
  let parsedAbi: unknown
  try {
    parsedAbi = JSON.parse(options.abi)
  } catch {
    throw new Error('--abi must be a valid JSON array')
  }

  let parsedEvents: unknown
  try {
    parsedEvents = JSON.parse(options.events)
  } catch {
    throw new Error('--events must be valid JSON')
  }

  return {
    address: options.address,
    chain: options.chain,
    name: options.name,
    abi: parsedAbi,
    events: parsedEvents,
  }
}

export function createContractRun(options: CreateContractOptions) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/contracts/', buildCreateContractBody(options))
}

contracts.command('create', {
  description: 'Register a new smart contract to track',
  options: z.object({
    address: z.string().describe('Contract address (0x…)'),
    chain: z.coerce.number().describe('Chain ID (e.g. 1 for Ethereum, 137 for Polygon)'),
    name: z.string().describe('Human-readable contract name'),
    abi: z.string().describe('Contract ABI as a JSON string'),
    events: z.string().describe('Events configuration as a JSON string'),
  }),
  examples: [
    {
      options: {
        address: '0x1234…',
        chain: 1,
        name: 'My Token',
        abi: '[{"type":"event","name":"Transfer"}]',
        events: '{"Transfer":true}',
      },
      description: 'Register an ERC-20 contract on Ethereum',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ options }) {
    return createContractRun(options)
  },
})

// ── Update a contract ──

export interface UpdateContractOptions {
  name: string
  abi: string
  events: string
}

export function buildUpdateContractBody(options: UpdateContractOptions) {
  let parsedAbi: unknown
  try {
    parsedAbi = JSON.parse(options.abi)
  } catch {
    throw new Error('--abi must be a valid JSON array')
  }

  let parsedEvents: unknown
  try {
    parsedEvents = JSON.parse(options.events)
  } catch {
    throw new Error('--events must be valid JSON')
  }

  return {
    name: options.name,
    abi: parsedAbi,
    events: parsedEvents,
  }
}

export function updateContractRun(
  chain: string,
  address: string,
  options: UpdateContractOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/contracts/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
    buildUpdateContractBody(options),
  )
}

contracts.command('update', {
  description: 'Update a tracked contract',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x…)'),
  }),
  options: z.object({
    name: z.string().describe('Updated contract name'),
    abi: z.string().describe('Updated ABI as a JSON string'),
    events: z.string().describe('Updated events configuration as a JSON string'),
  }),
  examples: [
    {
      args: { chain: '1', address: '0x1234…' },
      options: {
        name: 'Renamed Token',
        abi: '[{"type":"event","name":"Transfer"}]',
        events: '{"Transfer":true}',
      },
      description: 'Update a contract',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ args, options }) {
    return updateContractRun(args.chain, args.address, options)
  },
})

// ── Delete a contract ──

export function deleteContractRun(chain: string, address: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(
    `/v0/contracts/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
  )
}

contracts.command('delete', {
  description: 'Remove a tracked contract',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x…)'),
  }),
  examples: [
    {
      args: { chain: '1', address: '0x1234…' },
      description: 'Delete a contract',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ args }) {
    return deleteContractRun(args.chain, args.address)
  },
})
