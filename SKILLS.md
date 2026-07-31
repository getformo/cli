# Formo CLI Skills

Skills available via the `formo` CLI. Requires a Formo API key — set `FORMO_API_KEY` or run `formo login <apiKey>`.

## Install the agent skill

Install the [`formo-analytics`](skills/formo-analytics/SKILL.md) skill in an Agent Skills-compatible tool:

```bash
npx skills add https://github.com/getformo/cli/tree/main/skills/formo-analytics
```

---

## Authentication

### Save API key

```bash
formo login <apiKey>
```

Saves your key to `~/.config/formo/config.json`. The `FORMO_API_KEY` environment variable takes precedence if set.

For local development, set `FORMO_API_BASE_URL` for the REST API host and `FORMO_EVENTS_BASE_URL` for event ingestion.

### Check authentication status

```bash
formo status
```

Shows whether an API key is configured, where it was loaded from (env var or config file), and masked key value.

### Log out

```bash
formo logout
```

Removes the saved API key and clears authentication state.

---

## Wallet Profiles

### Get a wallet profile

Fetch the full profile for a single wallet by address or ENS name.

```bash
formo profiles get <address>
formo profiles get <address> --expand labels,chains,apps,tokens
```

| Argument | Description |
|---|---|
| `address` | Wallet address (`0x…`) or ENS name (e.g. `vitalik.eth`) |

| Option | Description |
|---|---|
| `--expand` | Comma-separated fields to include in full: `apps`, `chains`, `tokens`, `labels` |

**Examples:**
```bash
# Basic profile
formo profiles get 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Profile with labels and chain breakdown
formo profiles get vitalik.eth --expand labels,chains
```

---

### Search wallet profiles

Search and filter the profiles dataset with sorting, pagination, and advanced filter conditions.

```bash
formo profiles search [options]
```

| Option | Values | Description |
|---|---|---|
| `--address` | `string` | Filter to a specific wallet address |
| `--search` | `string` | Free-text search across address and identity fields |
| `--page` | `number` | Page number (1-indexed, default `1`) |
| `--size` | `number` | Page size (default `100`, max `1000`) |
| `--order-by` | see below | Field to sort by |
| `--order-dir` | `asc`, `desc` | Sort direction |
| `--expand` | `string` | Comma-separated fields to expand |
| `--filters` | JSON array | Advanced canonical filter objects (see below) |
| `--logic` | `and`, `or` | Logic operator for combining filters (default `and`) |

**`--order-by` values:** `last_onchain`, `first_onchain`, `net_worth_usd`, `updated_at`, `tx_count`, `first_seen`, `last_seen`, `num_sessions`, `revenue`, `volume`, `points`

**Examples:**
```bash
# First 10 profiles
formo profiles search --size 10

# Top 5 by net worth (descending)
formo profiles search --order-by net_worth_usd --order-dir desc --size 5

# Profiles with net worth over $10k
formo profiles search --filters '[{"field":"users.net_worth_usd","op":"gt","value":10000}]' --size 20

# Profiles with > $1k balance on Ethereum (chain 1)
formo profiles search --filters '[{"field":"chains.balance","op":"gt","value":1000,"chain_id":"1"}]' --size 20

# Second page of 20, sorted by tx count
formo profiles search --order-by tx_count --order-dir desc --page 2 --size 20 --expand labels
```

**FilterCondition schema:**
```json
{ "field": "users.net_worth_usd", "op": "gt", "value": 10000 }
```

| Property | Type | Description |
|---|---|---|
| `field` | `string` | **Canonical path** — `users.{attribute}` or a resource path below. A bare name like `net_worth_usd` is silently ignored by the API; identifier-in-path fields like `chains.1.balance` are rejected with a `400` |
| `op` | `string` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains` (social fields only), `notEmpty` / `isEmpty` (value-less existence checks). Long-form spellings (`equals`, `greater`, `includes`, …) are retired — the API rejects them with a `400` naming the token |
| `value` | `any` | Value to compare against; must be a number on the `.balance` fields |
| `chain_id` | `string` | _(optional on any resource filter)_ restrict to one chain; omit to match any |
| `app_id` | `string` | _(required by `apps.balance`, and by `tokens.balance` with `scope: protocol`)_ e.g. `aave-v3` |
| `token_address` | `string` | _(required by `tokens.balance`)_ |
| `tag_id` | `string` | _(required by `labels.value`)_ e.g. `coinbase.verified_account` |
| `scope` | `string` | _(required by `tokens.balance`)_ `any` or `protocol` |

**Canonical fields — resource identity goes in the qualifiers, never in the path:**

| Field | Required qualifiers | Example |
|---|---|---|
| `users.{attribute}` | none | `{"field":"users.net_worth_usd","op":"gt","value":10000}` |
| `chains.balance` | none (`chain_id` optional) | `{"field":"chains.balance","op":"gte","value":1000,"chain_id":"1"}` |
| `apps.balance` | `app_id` | `{"field":"apps.balance","op":"gt","value":500,"app_id":"uniswap-v3"}` |
| `tokens.balance` | `token_address`, `scope` | `{"field":"tokens.balance","op":"gt","value":0,"token_address":"0xA0b8…48","scope":"any"}` |
| `labels.value` | `tag_id` | `{"field":"labels.value","op":"eq","value":"true","tag_id":"coinbase.verified_account"}` |

User attributes for `users.{attribute}`: `net_worth_usd`, `volume`, `revenue`,
`points`, `device`, `location`, `lifecycle`, `ens`, `farcaster`, and the other
social handles.

Combine multiple filters with `--logic and` (default) or `--logic or`.

---

### Update profile properties

```bash
formo profiles update <address> --properties '{"display_name":"Alice","twitter":"alice"}'
formo profiles properties batch --rows '[{"address":"0xabc...","display_name":"Alice"}]'
```

> Requires `profiles:write` scope.

### Manage profile labels

```bash
formo profiles labels create <address> --tag-id vip --value tier-1
formo profiles labels create <address> --tag-id tier --timestamp 2024-03-15T00:00:00.000Z --is-deleted
formo profiles labels batch --labels '[{"address":"0xabc...","tag_id":"vip","value":"tier-1"}]'
formo profiles labels delete <address> --tag-id vip
```

> Requires `profiles:write` scope.

---

## SQL Analytics Queries

### Run a SQL query

Execute a SQL query against your Formo analytics data (events, sessions, wallet profiles).

```bash
formo query run "<sql>"
```

> Requires `query:read` scope on your API key.

**Examples:**
```bash
# Count total events
formo query run "SELECT count(*) FROM events"

# Top 10 wallets by net worth
formo query run "SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10"

# Recent sessions
formo query run "SELECT address, last_seen FROM wallet_profiles ORDER BY last_seen DESC LIMIT 5"
```

---

## Pre-built Analytics

Pre-computed analytics pipes — the same data that powers the Formo dashboard — without writing SQL.

```bash
formo analytics <pipe> [options]
```

> Requires `query:read` scope on your API key.

**Pipes:** `kpis`, `event_timeseries`, `funnel`, `flow`, `frequency`, `lifecycle`, `retention`, `revenue_overview`, `revenue_by_metric`, `revenue_timeseries`, `volume_by_metric`, `top_chains`, `top_events`, `top_locations`, `top_pages`, `top_sources`, `top_wallets`

| Option | Description |
|---|---|
| `--date-from` | Inclusive start date `YYYY-MM-DD` (default: 7 days before `--date-to`) |
| `--date-to` | Inclusive end date `YYYY-MM-DD` (default: today) |
| `--filters` | JSON array of `[{field,op,value}]`. For `in`/`nin`, array values are preferred; pipe-delimited strings are also accepted. Array string members cannot contain `|` |
| `--params` | JSON object of pipe-specific params merged into the query (e.g. `{"limit":10,"group_by":"device"}`) |

**Examples:**
```bash
# Traffic KPIs for the last 7 days (default range)
formo analytics kpis

# KPIs for April 2026, broken down by device
formo analytics kpis --date-from 2026-04-01 --date-to 2026-04-30 --params '{"group_by":"device"}'

# Conversion funnel across ordered steps (each step: {type,event,name,filters?})
formo analytics funnel --date-from 2026-04-01 --date-to 2026-04-30 --params '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]},{"type":"track","event":"connect","name":"connect::1","filters":[]}],"window_seconds":86400}'

# Top 10 wallets by activity last month
formo analytics top_wallets --date-from 2026-04-01 --date-to 2026-04-30 --params '{"limit":10}'

# Retention filtered to US visitors
formo analytics retention --filters '[{"field":"location","op":"eq","value":"US"}]'
```

Each pipe accepts pipe-specific params via `--params` (see each command's `--help`): e.g. `funnel` → `steps`, `window_seconds`, `funnel_type`, `group_by`, `limit`, `attribution`; `kpis` → `group_by`, `limit`; `top_*` → `limit`, `offset`.

---

## Project Alerts

Manage project alerts that trigger notifications when conditions are met (e.g. high-value transaction events, metric thresholds). Alerts are delivered via configured recipients such as webhooks.

### List all alerts

```bash
formo alerts list
```

> Requires `alerts:read` scope.

### Get a single alert

```bash
formo alerts get <alertId>
```

| Argument | Description |
|---|---|
| `alertId` | The alert's unique ID |

> Requires `alerts:read` scope.

### Create an alert

```bash
formo alerts create --name <name> --trigger-type <type> [options]
```

| Option | Description |
|---|---|
| `--name` | Alert name |
| `--trigger-type` | Trigger type: `event` or `user` |
| `--trigger-filters` | JSON array of trigger filter objects (optional) |
| `--recipient` | JSON array of recipient objects (optional) |
| `--secret` | Webhook secret string (optional) |

> Requires `alerts:write` scope.

**Examples:**
```bash
# Create a basic event alert
formo alerts create --name "High value tx" --trigger-type event

# Create an alert with filters and recipients
formo alerts create --name "Whale alert" --trigger-type event \
  --trigger-filters '[{"field":"revenue","op":"gt","value":"100000"}]' \
  --recipient '[{"type":"webhook","value":["https://hooks.example.com/formo"]}]'
```

### Update an alert

```bash
formo alerts update <alertId> --name <name> --trigger-type <type> [options]
```

> Requires `alerts:write` scope.

### Delete an alert

```bash
formo alerts delete <alertId>
```

> Requires `alerts:write` scope.

### Toggle alert status

```bash
formo alerts toggle <alertId> --status <active|inactive>
```

| Option | Values | Description |
|---|---|---|
| `--status` | `active`, `inactive` | New alert status |

> Requires `alerts:write` scope.

**Examples:**
```bash
# Deactivate an alert
formo alerts toggle alert_abc123 --status inactive

# Re-activate an alert
formo alerts toggle alert_abc123 --status active
```

### Test alert delivery

```bash
formo alerts test <alertId> --sample-event '{"event":"transaction","revenue":250}'
```

---

## Dashboard Boards

Manage dashboard boards that organize charts and visualizations for your project analytics.

### List all boards

```bash
formo boards list
```

> Requires `boards:read` scope.

### Get a single board

```bash
formo boards get <boardId>
```

> Requires `boards:read` scope.

### Create a board

```bash
formo boards create --title <title> [--description <desc>] [--is-public]
```

| Option | Description |
|---|---|
| `--title` | Board title |
| `--description` | Board description (optional) |
| `--is-public` | Whether the board is publicly viewable |

> Requires `boards:write` scope.

**Examples:**
```bash
formo boards create --title "KPI Dashboard"
formo boards create --title "Revenue Metrics" --description "Weekly revenue tracking"
```

### Update a board

```bash
formo boards update <boardId> [--title <title>] [--description <desc>] [--is-public]
```

> Requires `boards:write` scope.

### Delete a board

```bash
formo boards delete <boardId>
```

> Requires `boards:write` scope.

---

## Charts

Manage charts within dashboard boards. Charts are visualizations of analytics data (line charts, bar charts, funnels, etc.).

### List charts in a board

```bash
formo charts list --board-id <boardId>
```

> Requires `boards:read` scope.

### List chart metadata

```bash
formo charts meta --board-id <boardId>
```

> Requires `boards:read` scope.

### Get a single chart

```bash
formo charts get <chartId> --board-id <boardId>
```

> Requires `boards:read` scope.

### Create a chart

```bash
formo charts create --board-id <boardId> [--body '<json>' | typed chart options]
```

| Option | Description |
|---|---|
| `--board-id` | Board ID to add the chart to |
| `--body` | Full chart configuration as a JSON string |
| `--title` | Chart title |
| `--chart-type` | `table`, `number`, `funnel`, `bar`, `line`, `area`, `pie`, `stacked`, `user_paths`, `retention` |
| `--query` | SQL query for SQL-backed charts |
| `--x-axis` / `--y-axis` / `--group-by` | Chart encodings |
| `--steps` | JSON array of funnel steps |
| `--settings` | JSON settings object. User Paths require `anchors` and accept `maxSteps` / `nodesPerStep`; retention requires an `entryFilter` key |

> Requires `boards:write` scope.

**Examples:**
```bash
formo charts create --board-id board_abc123 \
  --title "Daily active users" --chart-type line \
  --query "SELECT toDate(timestamp) AS date, countDistinct(address) AS users FROM events GROUP BY date ORDER BY date" \
  --x-axis date --y-axis users
```

### Update a chart

```bash
formo charts update <chartId> --board-id <boardId> --body '<json>'
```

> Requires `boards:write` scope.

### Query, move, duplicate, or reorder charts

```bash
formo charts query <chartId> --board-id <boardId> --date-from 2026-04-01 --date-to 2026-04-30
formo charts move <chartId> --board-id <sourceBoardId> --target-board-id <targetBoardId>
formo charts duplicate <chartId> --board-id <boardId>
formo charts reorder --board-id <boardId> --chart-ids chart_a,chart_b,chart_c
```

### Delete a chart

```bash
formo charts delete <chartId> --board-id <boardId>
```

> Requires `boards:write` scope.

---

## Smart Contracts

Manage tracked smart contracts for on-chain event indexing. Register contracts with their ABI to automatically index and process blockchain events.

### List all contracts

```bash
formo contracts list
```

> Requires `contracts:read` scope.

### Get a contract

```bash
formo contracts get <chain> <address>
```

> Requires `contracts:read` scope.

### Get recommended contracts

```bash
formo contracts recommendations
```

Lists contracts the project already interacts with but has not added yet.

> Requires `contracts:read` scope.

### Register a contract

```bash
formo contracts create --address <addr> --chain <chainId> --name <name> --abi '<json>' --events '<json>'
```

| Option | Description |
|---|---|
| `--address` | Contract address (`0x…`) |
| `--chain` | Chain ID (e.g. `1` for Ethereum, `137` for Polygon) |
| `--name` | Human-readable contract name |
| `--abi` | Contract ABI as a JSON string |
| `--events` | JSON array of ABI event objects to monitor |
| `--start-block` | Optional start block |
| `--include-in-pipeline` | Include this contract in the Goldsky events pipeline |

> Requires `contracts:write` scope.

**Examples:**
```bash
formo contracts create \
  --address 0x1234567890abcdef1234567890abcdef12345678 \
  --chain 1 \
  --name "My Token" \
  --abi '[{"type":"event","name":"Transfer","inputs":[]}]' \
  --events '[{"type":"event","name":"Transfer","inputs":[]}]'
```

### Update a contract

```bash
formo contracts update <chain> <address> --name <name> --abi '<json>' --events '<json>'
```

| Argument | Description |
|---|---|
| `chain` | Chain ID |
| `address` | Contract address (`0x…`) |

> Requires `contracts:write` scope.

### Toggle pipeline inclusion

```bash
formo contracts pipeline <chain> <address> --include-in-pipeline false
```

Use this when a contract should remain registered for ABI decoding but be excluded from pipeline deploys.

> Requires `contracts:write` scope.

### Delete a contract

```bash
formo contracts delete <chain> <address>
```

> Requires `contracts:write` scope.

---

## User Segments

Manage user segments — saved audience groups defined by filter criteria for targeting and analysis.

### List all segments

```bash
formo segments list
```

> Requires `segments:read` scope.

### Create a segment

```bash
formo segments create --title <title> --filters '<json>'
```

| Option | Description |
|---|---|
| `--title` | Segment title |
| `--filters` | JSON array of canonical `{field,op,value}` filter objects. Array string members cannot contain `|` |

> Requires `segments:write` scope.

**Examples:**
```bash
formo segments create --title "Whales" --filters '[{"field":"net_worth_usd","op":"gt","value":"100000"}]'
```

### Delete a segment

```bash
formo segments delete <segmentId>
```

> Requires `segments:write` scope.

---

## Wallet Import

Bulk import wallet addresses into a project to track them. This creates identify events for each address.

```bash
formo import wallets --addresses '<json>'
formo import wallets --rows '<json>'
```

| Option | Description |
|---|---|
| `--addresses` | JSON array of wallet address strings to import |
| `--rows` | JSON array of `{address,properties?}` objects |

> Requires `profiles:write` scope. **Only available on Scale and Enterprise plans.**

**Examples:**
```bash
formo import wallets \
  --addresses '["0xabc123…","0xdef456…"]'

formo import wallets \
  --rows '[{"address":"0xabc123…","properties":{"display_name":"Alice"}}]'
```

---

## Raw Event Ingestion

Send analytics events to `events.formo.so` with a project SDK write key.

```bash
export FORMO_WRITE_KEY=formo_write_key_xxx
formo events ingest --event '{"type":"track","channel":"cli","version":"1","anonymous_id":"anon_123","event":"CLI Test","context":{},"properties":{},"original_timestamp":"2026-04-27T23:05:38.000Z","sent_at":"2026-04-27T23:05:42.000Z","message_id":"cli-test-1"}'
```

---

## AI Agent Usage

The `formo` CLI is built with [incur](https://github.com/tryincur/incur), which exposes a structured tool manifest for AI agents. When used in an agent environment, the agent can discover all available commands and call them with type-safe arguments automatically.

Suggested prompts for agents:
- "Get the profile for wallet `0xabc`"
- "Search profiles with net worth greater than 10000"
- "Run a SQL query on my analytics data"
- "Search profiles ordered by last_onchain descending"
- "List all project alerts"
- "Create an alert for high-value transactions"
- "List all dashboard boards"
- "List charts in board_abc123"
- "List all tracked contracts"
- "Register a new smart contract on Ethereum"
- "List all user segments"
- "Import wallet addresses into my project"
