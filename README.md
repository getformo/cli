# @formo/cli

Command-line interface for the Formo API. Manage wallet profiles, alerts, dashboards, charts, contracts, segments, and run analytics SQL — directly from your terminal or via AI agents.

## Installation

```bash
npm install -g @formo/cli
# or use without installing:
npx @formo/cli
```

## Install the Formo Analytics agent skill

This repository also ships the [`formo-analytics`](skills/formo-analytics/SKILL.md) skill for Claude Code, Codex, and other [Agent Skills](https://agentskills.io)-compatible tools. It teaches agents to use Formo's MCP server, CLI, and REST API for project-scoped product and onchain analytics.

Install it in the current project:

```bash
npx skills add https://github.com/getformo/cli/tree/main/skills/formo-analytics
```

Or install it globally for Claude Code and Codex:

```bash
npx skills add getformo/cli --skill formo-analytics --global \
  --agent claude-code --agent codex
```

## Authentication

Save your API key locally:

```bash
formo login <apiKey>
```

Or set the `FORMO_API_KEY` environment variable — it takes precedence over the saved config:

```bash
export FORMO_API_KEY=formo_abc123
```

Get your API key from `Settings → API Keys` in the [Formo dashboard](https://app.formo.so).

For local development or proxying, override API hosts with:

```bash
export FORMO_API_BASE_URL=http://localhost:3001
export FORMO_EVENTS_BASE_URL=http://localhost:3002
```

---

## Auth commands

### `formo login [apiKey]`

Save your API key to `~/.config/formo/config.json`. Validates the key against the API and stores the workspace context.

```bash
formo login formo_abc123
```

### `formo logout`

Remove the saved API key and clear authentication state.

```bash
formo logout
```

### `formo status`

Show current authentication state, workspace, and project ID.

```bash
formo status
```

---

## `formo profiles`

Wallet profile commands.

### `profiles get <address>`

Fetch a single wallet profile by address or ENS name.

| Option | Description |
|---|---|
| `--expand` | Comma-separated fields: `apps`, `chains`, `tokens`, `labels` |

```bash
formo profiles get 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
formo profiles get vitalik.eth --expand labels,chains
```

### `profiles search`

Search wallet profiles with filters, sorting, and pagination. Returns a `PaginatedResponse<Profile>`.

| Option | Description |
|---|---|
| `--address` | Filter by wallet address |
| `--page` | Page number (1-indexed, default `1`) |
| `--size` | Page size (default `100`, max `1000`) |
| `--order-by` | `last_onchain`, `first_onchain`, `net_worth_usd`, `updated_at`, `tx_count`, `first_seen`, `last_seen`, `num_sessions`, `revenue`, `volume`, `points` |
| `--order-dir` | `asc` or `desc` |
| `--expand` | Comma-separated fields to expand |
| `--conditions` | JSON array of `FilterCondition` objects (see below) |
| `--logic` | Combine conditions with `and` (default) or `or` |

```bash
formo profiles search --size 10
formo profiles search --order-by net_worth_usd --order-dir desc --size 5
formo profiles search --page 2 --size 20
formo profiles search --conditions '[{"field":"users.net_worth_usd","op":"gt","value":10000}]' --size 20
formo profiles search --conditions '[{"field":"users.net_worth_usd","op":"gt","value":10000},{"field":"users.volume","op":"gt","value":1000}]' --logic or --size 20
formo profiles search --conditions '[{"field":"chains.1.balance","op":"gt","value":1000}]' --size 20
```

### `profiles update <address>`

Merge-update identity properties on a wallet profile.

| Option | Description |
|---|---|
| `--properties` | JSON object of properties to merge |

**Allowed property keys:** `user_id`, `display_name`, `email`, `farcaster`, `discord`, `twitter`, `telegram`, `instagram`, `website`, `github`, `linkedin`, `facebook`, `tiktok`, `youtube`, `reddit`, `avatar`, `description`, `location`, `ens`, `lens`, `basenames`, `linea`. Unknown keys are rejected server-side.

```bash
formo profiles update 0xd8dA... --properties '{"display_name":"Vitalik","twitter":"VitalikButerin"}'
formo profiles update vitalik.eth --properties '{"email":"alice@example.com"}'
```

> Requires `profiles:write` scope.

### `profiles properties batch`

Batch update first-party properties for up to 100 wallets.

```bash
formo profiles properties batch \
  --rows '[{"address":"0xd8dA...","display_name":"alice.eth","email":"alice@example.com"}]'
```

### `profiles labels create <address>`

Upsert one or more labels on a wallet profile. Provide either a single label via `--tag-id` or a batch via `--labels`.

| Option | Description |
|---|---|
| `--tag-id` | Label identifier (e.g. `vip`, `airdrop_eligible`) |
| `--value` | Optional label value (e.g. tier name, country code) |
| `--chain-id` | Optional chain identifier the label applies to |
| `--timestamp` | Optional historical ISO-8601 timestamp |
| `--is-deleted` | Backfill a historical label removal tombstone |
| `--labels` | JSON array of `UserLabelInput` objects for batch upsert |

```bash
formo profiles labels create 0xd8dA... --tag-id vip
formo profiles labels create 0xd8dA... --tag-id tier --value gold --chain-id 1
formo profiles labels create 0xd8dA... --labels '[{"tag_id":"vip"},{"tag_id":"airdrop_eligible","chain_id":"1"}]'
formo profiles labels create 0xd8dA... --tag-id tier --timestamp 2024-03-15T00:00:00.000Z --is-deleted
formo profiles labels batch --labels '[{"address":"0xd8dA...","tag_id":"vip","value":"tier-1"}]'
```

### `profiles labels delete <address>`

Delete a label from a wallet profile.

| Option | Description |
|---|---|
| `--tag-id` | Label identifier to delete (required) |
| `--chain-id` | Optional chain identifier to scope the deletion |

```bash
formo profiles labels delete 0xd8dA... --tag-id vip
formo profiles labels delete 0xd8dA... --tag-id tier --chain-id 1
```

> Requires `profiles:write` scope.

---

## `formo alerts`

Project alert commands. Requires `alerts:read` (list/get) or `alerts:write` (create/update/delete/toggle).

### `alerts list`
List all alerts for the project.

### `alerts get <alertId>`
Get a single alert by ID.

### `alerts create`

| Option | Description |
|---|---|
| `--name` | Alert name |
| `--trigger-type` | Trigger type: `event` or `user` |
| `--trigger-filters` | JSON array of trigger filter objects |
| `--recipient` | JSON array of recipient objects |
| `--secret` | Webhook secret |

```bash
formo alerts create --name "High value tx" --trigger-type event \
  --trigger-filters '[{"name":"event","operator":"equals","value":"transaction"}]' \
  --recipient '[{"type":"email","value":["alerts@myapp.com"]}]'
```

### `alerts update <alertId>`
Same options as `create`. Replaces the alert configuration.

### `alerts delete <alertId>`
Delete an alert.

### `alerts toggle <alertId> --status <active|inactive>`
Toggle an alert between `active` and `inactive`.

```bash
formo alerts toggle alert_abc123 --status inactive
```

### `alerts test <alertId>`
Send a test alert delivery with optional sample payloads.

```bash
formo alerts test alert_abc123 --sample-event '{"event":"transaction","revenue":250}'
```

---

## `formo boards`

Dashboard board commands. Requires `boards:read` / `boards:write`.

### `boards list`
List all boards for the project.

### `boards get <boardId>`
Get a single board by ID.

### `boards create`

| Option | Description |
|---|---|
| `--title` | Board title |
| `--description` | Optional board description |
| `--is-public` | Make the board publicly viewable |

```bash
formo boards create --title "Revenue Metrics" --description "Weekly revenue tracking"
```

### `boards update <boardId>`

| Option | Description |
|---|---|
| `--title` | New board title |
| `--description` | New board description |
| `--is-public` | Update public visibility |

### `boards delete <boardId>`
Delete a board.

---

## `formo charts`

Chart commands. Charts live inside a board. Requires `charts:read` / `charts:write`.

### `charts list --board-id <boardId>`
List all charts in a board.

### `charts get <chartId> --board-id <boardId>`
Get a single chart by ID.

### `charts meta --board-id <boardId>`
List lightweight chart metadata without executing chart queries.

### `charts create --board-id <boardId> [options]`
Create a chart from typed flags or a raw JSON body.

```bash
formo charts create --board-id brd_123 --title "Daily Active Users" \
  --chart-type line \
  --query "SELECT toDate(timestamp) AS date, countDistinct(address) AS users FROM events GROUP BY date ORDER BY date" \
  --x-axis date --y-axis users

formo charts create --board-id brd_123 --body '{"title":"Recent Events","chart_type":"table","query":"SELECT * FROM events LIMIT 10"}'
```

### `charts update <chartId> --board-id <boardId> --body '<json>'`
Update a chart.

### `charts query <chartId> --board-id <boardId> --date-from <YYYY-MM-DD> --date-to <YYYY-MM-DD>`
Execute a saved chart that uses `{{date_from}}` / `{{date_to}}` variables.

### `charts move|duplicate|reorder`
Move a chart to another board, duplicate a chart, or reorder charts in a board.

### `charts delete <chartId> --board-id <boardId>`
Delete a chart.

---

## `formo contracts`

Smart contract commands. Requires `contracts:read` / `contracts:write`.

### `contracts list`
List all tracked contracts. Returns `{ data: Contract[], deploy: { last_deployed_at, diff }, total, page, size, has_more }`.

### `contracts get <chain> <address>`
Get a single tracked contract.

### `contracts recommendations`
List contracts the project already interacts with but has not added yet.

### `contracts create`

| Option | Description |
|---|---|
| `--address` | Contract address (`0x…`) |
| `--chain` | Chain ID (e.g. `1`, `137`) |
| `--name` | Human-readable contract name |
| `--abi` | Contract ABI as a JSON string; sent stringified to the API |
| `--events` | JSON array of ABI event objects to monitor |
| `--start-block` | Optional start block |
| `--include-in-pipeline` | Include this contract in the Goldsky events pipeline (`true` by default in the API) |

```bash
formo contracts create --address 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984 --chain 1 \
  --name "UNI Token" --abi '[{"type":"event","name":"Transfer","inputs":[]}]' \
  --events '[{"type":"event","name":"Transfer","inputs":[]}]'
```

### `contracts update <chain> <address>`

| Option | Description |
|---|---|
| `--name` | Updated contract name |
| `--abi` | Updated ABI |
| `--events` | Updated JSON array of ABI event objects |
| `--start-block` | Optional start block |
| `--include-in-pipeline` | Include or exclude this contract from the Goldsky events pipeline |

### `contracts pipeline <chain> <address> --include-in-pipeline <true|false>`
Toggle pipeline inclusion without re-sending the full ABI/events payload.

### `contracts delete <chain> <address>`
Remove a tracked contract.

---

## `formo segments`

User segment commands. Requires `segments:read` / `segments:write`.

### `segments list`
List all user segments.

### `segments create`

| Option | Description |
|---|---|
| `--title` | Segment title |
| `--filter-sets` | JSON array of filter set strings defining the segment |

### `segments delete <segmentId>`
Delete a user segment.

---

## `formo query`

### `query run "<sql>"`

Run a SQL query against your Formo analytics data. Returns `{ data, total, limit, offset, has_more }`.

```bash
formo query run "SELECT count(*) FROM events"
formo query run "SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10"
```

> Requires `query:read` scope.

---

## `formo analytics`

Pre-built analytics pipes — the same data that powers the Formo dashboard — without writing SQL. Each pipe is a subcommand: `formo analytics <pipe>`.

**Pipes:** `kpis`, `event_timeseries`, `funnel`, `flow`, `frequency`, `lifecycle`, `retention`, `revenue_overview`, `revenue_by_metric`, `revenue_timeseries`, `volume_by_metric`, `top_chains`, `top_events`, `top_locations`, `top_pages`, `top_sources`, `top_wallets`

| Option | Description |
|---|---|
| `--date-from` | Inclusive start date `YYYY-MM-DD` (default: 7 days before `--date-to`) |
| `--date-to` | Inclusive end date `YYYY-MM-DD` (default: today) |
| `--filters` | JSON array of `[{field,op,value}]`. Use `in`/`notIn` with a pipe-delimited value (e.g. `"chrome\|firefox"`) |
| `--params` | JSON object of pipe-specific params merged into the query (e.g. `{"limit":10,"group_by":"device"}`) |

```bash
formo analytics kpis
formo analytics kpis --date-from 2026-04-01 --date-to 2026-04-30 --params '{"group_by":"device"}'
formo analytics funnel --date-from 2026-04-01 --date-to 2026-04-30 --params '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]},{"type":"track","event":"connect","name":"connect::1","filters":[]}],"window_seconds":86400}'
formo analytics top_wallets --date-from 2026-04-01 --date-to 2026-04-30 --params '{"limit":10}'
formo analytics retention --filters '[{"field":"location","op":"equals","value":"US"}]'
```

> Requires `query:read` scope. Run `formo analytics <pipe> --help` for the pipe-specific params accepted via `--params`.

---

## `formo import`

### `import wallets`

Bulk-import wallet addresses into the project via the events API.

| Option | Description |
|---|---|
| `--addresses` | JSON array of wallet address strings |
| `--rows` | JSON array of `{address,properties?}` objects |

```bash
formo import wallets --addresses '["0xabc...","0xdef..."]'
formo import wallets --rows '[{"address":"0xabc...","properties":{"display_name":"Alice"}}]'
```

---

## `formo events`

### `events ingest`

Send raw analytics events to `events.formo.so`. This command uses a project SDK write key, not the workspace API key.

```bash
export FORMO_WRITE_KEY=formo_write_key_xxx
formo events ingest --event '{"type":"track","channel":"cli","version":"1","anonymous_id":"anon_123","event":"CLI Test","context":{},"properties":{},"original_timestamp":"2026-04-27T23:05:38.000Z","sent_at":"2026-04-27T23:05:42.000Z","message_id":"cli-test-1"}'
```

---

## FilterCondition reference

`profiles search --conditions` accepts a JSON array of filter condition objects:

```json
[
  { "field": "users.net_worth_usd", "op": "gt", "value": 10000 },
  { "field": "chains.1.balance", "op": "gte", "value": 1000 }
]
```

> **The `field` must be a typed path.** A bare name like `net_worth_usd` is
> silently ignored by the API (no error, no filtering — the search returns
> everything). Always prefix the field with its type.

| Field | Type | Description |
|---|---|---|
| `field` | `string` | Typed path (see prefixes below) |
| `op` | `string` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin` |
| `value` | `any` | Value to compare against |
| `scope` | `string` | _(token filters only)_ `any` or `protocol` |
| `appId` | `string` | _(token filters with `scope: protocol`)_ e.g. `aave-v3` |

| Prefix | Examples |
|---|---|
| `users.` | `users.net_worth_usd`, `users.volume`, `users.revenue`, `users.points`, `users.device`, `users.location`, `users.lifecycle`, `users.ens`, `users.farcaster` |
| `chains.` | `chains.balance` (any chain), `chains.1.balance` (Ethereum) |
| `apps.` | `apps.uniswap-v3.balance` |
| `tokens.` | `tokens.0xA0b8…48.balance` |
| `labels.` | `labels.coinbase.verified_account` |

Combine multiple conditions with `--logic and` (default) or `--logic or`.

---

## Output formats

Every command supports the standard incur output flags:

| Flag | Description |
|---|---|
| `--format <toon\|json\|yaml\|md\|jsonl>` | Output format (default: `toon`) |
| `--json` | Shorthand for `--format json` |
| `--verbose` | Include the full envelope (`ok`, `data`, `meta`) |
| `--filter-output <keys>` | Filter output by key paths (e.g. `data,meta.duration`) |

Every list endpoint returns a `PaginatedResponse<T>` envelope: `{ data: [...], total, page, size, has_more }`. Every error follows: `{ error: { code, message, doc_url, param?, details? } }` — branch on `error.code`, not `message`.

---

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build TypeScript
pnpm build

# Lint
pnpm lint

# Run tests (requires TEST_TOKEN in .env)
pnpm test
```
