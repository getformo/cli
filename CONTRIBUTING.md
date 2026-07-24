# Contributing to @formo/cli

## Overview

The Formo CLI is built with [incur](https://github.com/tryincur/incur), a type-safe CLI framework that also runs as an AI agent tool server. Commands are defined declaratively with Zod schemas for arguments and options, and the same definitions power both human terminal usage and AI agent discovery via the `sync` mode.

## Project structure

```
cli/
├── src/
│   ├── index.ts              # CLI entry point — registers all commands and calls cli.serve()
│   ├── commands/             # one file per command group + exported run helpers
│   │   ├── alerts.ts
│   │   ├── analytics.ts
│   │   ├── boards.ts
│   │   ├── charts.ts
│   │   ├── contracts.ts
│   │   ├── events.ts
│   │   ├── import.ts
│   │   ├── profiles.ts
│   │   ├── query.ts
│   │   └── segments.ts
│   └── lib/
│       ├── client.ts         # axios HTTP client factory + requireApiKey guard
│       ├── config.ts         # ~/.config/formo/config.json read/write + FORMO_API_KEY env
│       ├── json.ts           # JSON option parsing helpers
│       ├── sql.ts            # SQL helpers (strip trailing FORMAT clause)
│       └── ui.ts             # terminal styling utilities
├── test/
│   ├── commands/             # per-command tests (mostly live-API integration tests)
│   ├── lib/                  # unit tests for lib modules
│   ├── helpers/
│   │   └── liveApi.ts        # probes the live API once; skips integration tests on auth failure
│   ├── preload.cjs           # loads .env, maps TEST_TOKEN → FORMO_API_KEY
│   └── setup.ts
├── .mocharc.json
├── CONTRIBUTING.md
├── README.md
├── SKILLS.md
├── package.json
├── tsconfig.json
└── tsconfig.test.json
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
5. Write tests in `test/commands/<name>.test.ts`.

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
# Install dependencies
pnpm install

# Run in dev mode (ts-node, no build needed)
FORMO_API_KEY=formo_xxx pnpm dev profiles get 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Or set the key once and run any command
export FORMO_API_KEY=formo_xxx
pnpm dev query run "SELECT count(*) FROM events"

# Build TypeScript
pnpm build

# Run the built entrypoint directly
node dist/index.js profiles search --size 5
```

## Running tests

```bash
# Run all tests once
pnpm test

# Watch mode
pnpm test:watch
```

Tests live in `test/` and run with [Mocha](https://mochajs.org/) via [tsx](https://tsx.is/) (see `.mocharc.json`), with [chai](https://www.chaijs.com/) `expect` assertions. There are two kinds of tests:

- **Live-API integration tests** — most of `test/commands/` hits the real Formo API. `test/preload.cjs` loads `.env` and requires `TEST_TOKEN` (mapped to `FORMO_API_KEY`) before any test module loads; the run aborts if it is missing. `test/helpers/liveApi.ts` probes the API once and, if the key is rejected or the API is unreachable, integration tests are skipped with a clear message via `requiresLiveApi(this)`.
- **Pure unit tests** — `test/commands/bodyBuilders.test.ts` and the `test/lib/` suites test exported helpers (body builders, JSON/SQL parsing, config) directly without any network calls.

Note: `requireApiKey()` and `JSON.parse()` errors throw **synchronously**, so use `expect(() => fn()).to.throw(...)` for those cases.

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

The test suite needs a real API key: add `TEST_TOKEN=formo_your_key` to a `.env` file in the repo root before running `pnpm test`. For manual end-to-end testing:

```bash
# Option 1: env var (temporary)
FORMO_API_KEY=formo_xxx pnpm dev profiles get vitalik.eth

# Option 2: save to config file (persistent)
pnpm dev login formo_xxx
pnpm dev profiles get vitalik.eth
```

The config is stored at `~/.config/formo/config.json` with mode `0600`.
