# Contributing to @formo/cli

## Overview

The Formo CLI is built with [incur](https://github.com/tryincur/incur), a type-safe CLI framework that also runs as an AI agent tool server. Commands are defined declaratively with Zod schemas for arguments and options, and the same definitions power both human terminal usage and AI agent discovery via the `sync` mode.

## Project structure

```
apps/cli/
├── src/
│   ├── index.ts              # CLI entry point — registers all commands and calls cli.serve()
│   ├── commands/
│   │   ├── profiles.ts       # profiles get / profiles search commands + exported run helpers
│   │   ├── profiles.test.ts  # unit tests for profiles commands
│   │   ├── query.ts          # query run command + exported run helper
│   │   └── query.test.ts     # unit tests for query commands
│   └── lib/
│       ├── client.ts         # axios HTTP client factory + requireApiKey guard
│       ├── client.test.ts    # unit tests for client
│       ├── config.ts         # ~/.config/formo/config.json read/write + FORMO_API_KEY env
│       └── config.test.ts    # unit tests for config
├── CONTRIBUTING.md
├── README.md
├── SKILLS.md
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## How commands work

Each command is registered on an `incur` CLI instance with a Zod schema for args/options and a `run()` function. To keep the code testable, the actual logic is extracted into a named helper function that `run()` delegates to:

```ts
// Exported helper — easy to test directly
export function getProfileRun(address: string, expand?: string) {
  requireApiKey()
  const client = createClient()
  // ...
  return client.get(...)
}

// Incur command — thin wrapper
profiles.command('get', {
  args: z.object({ address: z.string() }),
  options: z.object({ expand: z.string().optional() }),
  run({ args, options }) {
    return getProfileRun(args.address, options.expand)
  },
})
```

This pattern means tests call `getProfileRun(...)` directly without needing to invoke incur internals.

## Adding a new command

1. Create (or extend) a file in `src/commands/`.
2. Export a named helper function containing the logic.
3. Register the command on a `Cli.create(...)` subcommand group or directly on `cli`.
4. Register the group in `src/index.ts` if it's new.
5. Write tests in a `.test.ts` sibling file.

Minimal example — adding `formo wallets list`:

```ts
// src/commands/wallets.ts
import { Cli, z } from 'incur'
import { createClient, requireApiKey } from '../lib/client'

export const wallets = Cli.create('wallets', { description: 'Wallet commands' })

export function listWalletsRun(limit?: number) {
  requireApiKey()
  const client = createClient()
  return client.get('/v0/wallets/', { params: limit ? { limit } : {} })
}

wallets.command('list', {
  description: 'List wallets',
  options: z.object({ limit: z.coerce.number().optional() }),
  run({ options }) {
    return listWalletsRun(options.limit)
  },
})
```

```ts
// src/index.ts — add one line
cli.command(wallets)
```

## Terminal UI & Branding

The `src/lib/ui.ts` module provides terminal styling utilities. All colors use raw ANSI escape codes (no external dependencies) and auto-disable when stdout is not a TTY or `NO_COLOR` is set.

```ts
import { banner, color, success, error, warn, info } from '../lib/ui'

// Styled status messages (for process.stderr in commands)
process.stderr.write(success('Done!') + '\n')   // ✔ Done!
process.stderr.write(error('Failed') + '\n')     // ✖ Failed
process.stderr.write(warn('Careful') + '\n')     // ⚠ Careful
process.stderr.write(info('Note') + '\n')        // ℹ Note

// Color helpers
color.green('text')     // Green text
color.boldGreen('text') // Bold green text
color.dim('text')       // Dimmed text
color.red('text')       // Red text
```

**Important:** Write human-facing feedback to `process.stderr`, not `process.stdout`. This prevents colored text from mixing with structured data output (JSON, YAML) that incur writes to stdout.

## Local development

```bash
# Install dependencies from repo root
pnpm install

# Run in dev mode (ts-node, no build needed)
FORMO_API_KEY=formo_xxx pnpm --filter @formo/cli dev profiles get 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Or set the key once and run any command
export FORMO_API_KEY=formo_xxx
pnpm --filter @formo/cli dev query run "SELECT count(*) FROM events"

# Build TypeScript
pnpm --filter @formo/cli build

# Run the built binary directly
node apps/cli/dist/index.js profiles search --limit 5
```

## Running tests

```bash
# Run all tests once
pnpm --filter @formo/cli test

# Watch mode
pnpm --filter @formo/cli test:watch
```

Tests use [Vitest](https://vitest.dev/) with `vi.mock('../lib/client')` to isolate HTTP calls. The pattern is:

1. Mock `createClient` to return a fake axios instance with `vi.fn()` methods.
2. Mock `requireApiKey` to be a no-op (or throw for error cases).
3. Import and call the exported helper directly.
4. Assert on the mock calls.

Note: `requireApiKey()` and `JSON.parse()` errors throw **synchronously**, so use `expect(() => fn()).toThrow(...)` (not `rejects.toThrow`) for those cases.

## AI agent mode

incur exposes a `sync` interface that lets AI agents discover and call CLI commands as tools. The `suggestions` array in `src/index.ts` gives the agent example prompts:

```ts
const cli = Cli.create('formo', {
  sync: {
    suggestions: [
      'get the profile for wallet 0xabc',
      'search profiles with net worth > 10000',
    ],
  },
})
```

When an AI agent runs `formo` with the incur sync protocol, it gets a structured manifest of all available commands, their argument/option schemas, and examples — enabling it to call `formo` as a tool automatically. See `SKILLS.md` for a human-readable description of the available skills.

## Authentication in tests

Tests mock `requireApiKey` so they never need a real API key. For manual end-to-end testing:

```bash
# Option 1: env var (temporary)
FORMO_API_KEY=formo_xxx pnpm --filter @formo/cli dev profiles get vitalik.eth

# Option 2: save to config file (persistent)
pnpm --filter @formo/cli dev login formo_xxx
pnpm --filter @formo/cli dev profiles get vitalik.eth
```

The config is stored at `~/.config/formo/config.json` with mode `0600`.
