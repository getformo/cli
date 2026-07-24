import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'
import { parseJsonArray } from '../lib/json'
import {
  buildPaginationParams,
  paginationOptionsSchema,
  type PaginationOptions,
} from '../lib/pagination'

export type { PaginationOptions }

export const contracts = Cli.create('contracts', {
  description:
    'Smart contract commands — register, list, recommend, update, toggle pipeline inclusion, and remove tracked contracts',
})

function parseChain(chain: string | number) {
  const value = typeof chain === 'number' ? chain : Number(chain)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('chain must be a positive integer')
  }
  return value
}

// ── List contracts ──

export function listContractsRun(options: PaginationOptions = {}) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/contracts/', {
    params: buildPaginationParams(options),
  })
}

contracts.command('list', {
  description: 'List all tracked contracts for the project',
  options: z.object(paginationOptionsSchema),
  examples: [{ description: 'List all project contracts' }],
  hint: 'Requires contracts:read scope on your API key.',
  run({ options }) {
    return listContractsRun(options)
  },
})

// ── Get a contract ──

export function getContractRun(chain: string, address: string) {
  requireApiKey()
  const client = createClient()
  return client.get(
    `/v0/contracts/${parseChain(chain)}/${encodeURIComponent(address)}`,
  )
}

// ── Recommended contracts ──

export function getContractRecommendationsRun() {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/contracts/recommendations')
}

contracts.command('recommendations', {
  description:
    'List contracts the project already interacts with but has not added yet',
  options: z.object({}),
  examples: [
    {
      description: 'Show recommended contracts to add for decoding/monitoring',
    },
  ],
  hint: 'Requires contracts:read scope on your API key.',
  run() {
    return getContractRecommendationsRun()
  },
})

contracts.command('get', {
  description: 'Get a tracked contract by chain and address',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x...)'),
  }),
  examples: [
    {
      args: {
        chain: '1',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      description: 'Get a tracked USDC contract',
    },
  ],
  hint: 'Requires contracts:read scope on your API key.',
  run({ args }) {
    return getContractRun(args.chain, args.address)
  },
})

// ── Create a contract ──

export interface CreateContractOptions {
  address: string
  chain: number
  name: string
  abi: string
  events: string
  startBlock?: number
  includeInPipeline?: boolean
}

export function buildCreateContractBody(options: CreateContractOptions) {
  const parsedAbi = parseJsonArray(options.abi, '--abi')
  const parsedEvents = parseJsonArray(options.events, '--events')
  const body: Record<string, unknown> = {
    address: options.address,
    chain: parseChain(options.chain),
    name: options.name,
    abi: JSON.stringify(parsedAbi),
    events: parsedEvents,
  }
  if (options.startBlock !== undefined) body.start_block = options.startBlock
  if (options.includeInPipeline !== undefined) {
    body.include_in_pipeline = options.includeInPipeline
  }
  return body
}

export function createContractRun(options: CreateContractOptions) {
  requireApiKey()
  const client = createClient()
  return client.post('/v0/contracts/', buildCreateContractBody(options))
}

contracts.command('create', {
  description: 'Register a new smart contract to track',
  options: z.object({
    address: z.string().describe('Contract address (0x...)'),
    chain: z.coerce.number().describe('Chain ID (e.g. 1 for Ethereum, 137 for Polygon)'),
    name: z.string().describe('Human-readable contract name'),
    abi: z.string().describe('Contract ABI as a JSON string'),
    events: z.string().describe('JSON array of ABI event objects to monitor (max 10)'),
    startBlock: z.coerce.number().optional().describe('Optional start block'),
    includeInPipeline: z
      .boolean()
      .optional()
      .describe('Whether to include this contract in the Goldsky events pipeline'),
  }),
  examples: [
    {
      options: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chain: 1,
        name: 'USDC',
        abi: '[{"anonymous":false,"type":"event","name":"Transfer","inputs":[]}]',
        events: '[{"anonymous":false,"type":"event","name":"Transfer","inputs":[]}]',
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
  startBlock?: number
  includeInPipeline?: boolean
}

export function buildUpdateContractBody(
  chain: string | number,
  address: string,
  options: UpdateContractOptions,
) {
  const parsedAbi = parseJsonArray(options.abi, '--abi')
  const parsedEvents = parseJsonArray(options.events, '--events')
  const body: Record<string, unknown> = {
    address,
    chain: parseChain(chain),
    name: options.name,
    abi: JSON.stringify(parsedAbi),
    events: parsedEvents,
  }
  if (options.startBlock !== undefined) body.start_block = options.startBlock
  if (options.includeInPipeline !== undefined) {
    body.include_in_pipeline = options.includeInPipeline
  }
  return body
}

export function updateContractRun(
  chain: string,
  address: string,
  options: UpdateContractOptions,
) {
  requireApiKey()
  const client = createClient()
  return client.put(
    `/v0/contracts/${parseChain(chain)}/${encodeURIComponent(address)}`,
    buildUpdateContractBody(chain, address, options),
  )
}

contracts.command('update', {
  description: 'Update a tracked contract',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x...)'),
  }),
  options: z.object({
    name: z.string().describe('Updated contract name'),
    abi: z.string().describe('Updated ABI as a JSON string'),
    events: z.string().describe('Updated JSON array of ABI event objects to monitor'),
    startBlock: z.coerce.number().optional().describe('Optional start block'),
    includeInPipeline: z
      .boolean()
      .optional()
      .describe('Whether to include this contract in the Goldsky events pipeline'),
  }),
  examples: [
    {
      args: {
        chain: '1',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      options: {
        name: 'USD Coin',
        abi: '[{"anonymous":false,"type":"event","name":"Transfer","inputs":[]}]',
        events: '[{"anonymous":false,"type":"event","name":"Transfer","inputs":[]}]',
      },
      description: 'Update a contract',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ args, options }) {
    return updateContractRun(args.chain, args.address, options)
  },
})

// ── Toggle contract pipeline inclusion ──

export function updateContractPipelineRun(
  chain: string,
  address: string,
  includeInPipeline: boolean,
) {
  requireApiKey()
  const client = createClient()
  return client.patch(
    `/v0/contracts/${parseChain(chain)}/${encodeURIComponent(address)}/pipeline`,
    buildUpdateContractPipelineBody(includeInPipeline),
  )
}

export function buildUpdateContractPipelineBody(includeInPipeline: boolean) {
  return { include_in_pipeline: includeInPipeline }
}

contracts.command('pipeline', {
  description:
    'Toggle whether a tracked contract is included in the project events pipeline',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x...)'),
  }),
  options: z.object({
    includeInPipeline: z
      .boolean()
      .describe('true to include the contract in the pipeline, false to exclude it'),
  }),
  examples: [
    {
      args: {
        chain: '1',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      options: { includeInPipeline: false },
      description: 'Keep ABI decoding but exclude this contract from pipeline deploys',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ args, options }) {
    return updateContractPipelineRun(
      args.chain,
      args.address,
      options.includeInPipeline,
    )
  },
})

// ── Delete a contract ──

export function deleteContractRun(chain: string, address: string) {
  requireApiKey()
  const client = createClient()
  return client.delete(
    `/v0/contracts/${parseChain(chain)}/${encodeURIComponent(address)}`,
  )
}

contracts.command('delete', {
  description: 'Remove a tracked contract',
  args: z.object({
    chain: z.string().describe('Chain ID'),
    address: z.string().describe('Contract address (0x...)'),
  }),
  examples: [
    {
      args: {
        chain: '1',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      description: 'Delete a contract',
    },
  ],
  hint: 'Requires contracts:write scope on your API key.',
  run({ args }) {
    return deleteContractRun(args.chain, args.address)
  },
})
