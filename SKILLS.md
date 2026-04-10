# Formo CLI Skills

Skills available via the `formo` CLI. Requires a Formo API key — set `FORMO_API_KEY` or run `formo login <apiKey>`.

---

## Authentication

### Save API key

```bash
formo login <apiKey>
```

Saves your key to `~/.config/formo/config.json`. The `FORMO_API_KEY` environment variable takes precedence if set.

### Check authentication status

```bash
formo status
```

Shows whether an API key is configured, where it was loaded from (env var or config file), and masked key value.

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
| `--limit` | `number` | Max results (default: API default) |
| `--offset` | `number` | Pagination offset |
| `--orderBy` | see below | Field to sort by |
| `--orderDir` | `asc`, `desc` | Sort direction |
| `--expand` | `string` | Comma-separated fields to expand |
| `--conditions` | JSON array | Advanced filter conditions (see below) |

**`--orderBy` values:** `last_onchain`, `first_onchain`, `net_worth_usd`, `updated_at`, `tx_count`, `first_seen`, `last_seen`, `num_sessions`, `revenue`, `volume`, `points`

**Examples:**
```bash
# First 10 profiles
formo profiles search --limit 10

# Top 5 by net worth (descending)
formo profiles search --orderBy net_worth_usd --orderDir desc --limit 5

# Profiles with net worth over $10k
formo profiles search --conditions '[{"field":"net_worth_usd","op":"gt","value":10000}]' --limit 20

# High-activity wallets
formo profiles search --orderBy tx_count --orderDir desc --limit 10 --expand labels
```

**FilterCondition schema:**
```json
{ "field": "net_worth_usd", "op": "gt", "value": 10000 }
```

| Property | Type | Description |
|---|---|---|
| `field` | `string` | Profile field to filter on |
| `op` | `string` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin` |
| `value` | `any` | Value to compare against |

Multiple conditions are combined with `AND` logic.

---

## SQL Analytics Queries

### Run a SQL query

Execute a SQL query against your Formo analytics data (events, sessions, wallet profiles).

```bash
formo query "<sql>"
```

> Requires `query:read` scope on your API key.

**Examples:**
```bash
# Count total events
formo query "SELECT count(*) FROM events"

# Top 10 wallets by net worth
formo query "SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10"

# Recent sessions
formo query "SELECT address, last_seen FROM wallet_profiles ORDER BY last_seen DESC LIMIT 5"
```

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
formo alerts create --name <name> --triggerType <type> [options]
```

| Option | Description |
|---|---|
| `--name` | Alert name |
| `--triggerType` | Trigger type (e.g. `event`, `threshold`) |
| `--triggerFilters` | JSON array of trigger filter objects (optional) |
| `--recipient` | JSON array of recipient objects (optional) |
| `--secret` | Webhook secret string (optional) |

> Requires `alerts:write` scope.

**Examples:**
```bash
# Create a basic event alert
formo alerts create --name "High value tx" --triggerType event

# Create an alert with filters and recipients
formo alerts create --name "Whale alert" --triggerType threshold \
  --triggerFilters '[{"field":"amount","op":"gt","value":100000}]' \
  --recipient '["https://hooks.example.com/formo"]'
```

### Update an alert

```bash
formo alerts update <alertId> --name <name> --triggerType <type> [options]
```

> Requires `alerts:write` scope.

### Delete an alert

```bash
formo alerts delete <alertId>
```

> Requires `alerts:write` scope.

### Toggle alert status

```bash
formo alerts toggle <alertId> --status <active|paused>
```

| Option | Values | Description |
|---|---|---|
| `--status` | `active`, `paused` | New alert status |

> Requires `alerts:write` scope.

**Examples:**
```bash
# Pause an alert
formo alerts toggle alert_abc123 --status paused

# Re-activate an alert
formo alerts toggle alert_abc123 --status active
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
formo boards create --name <name> [--description <desc>]
```

| Option | Description |
|---|---|
| `--name` | Board name |
| `--description` | Board description (optional) |

> Requires `boards:write` scope.

**Examples:**
```bash
formo boards create --name "KPI Dashboard"
formo boards create --name "Revenue Metrics" --description "Weekly revenue tracking"
```

### Update a board

```bash
formo boards update <boardId> [--name <name>] [--description <desc>]
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
formo charts list --boardId <boardId>
```

> Requires `boards:read` scope.

### Get a single chart

```bash
formo charts get <chartId> --boardId <boardId>
```

> Requires `boards:read` scope.

### Create a chart

```bash
formo charts create --boardId <boardId> --body '<json>'
```

| Option | Description |
|---|---|
| `--boardId` | Board ID to add the chart to |
| `--body` | Full chart configuration as a JSON string |

> Requires `boards:write` scope.

**Examples:**
```bash
formo charts create --boardId board_abc123 \
  --body '{"name":"Daily active users","chartType":"line"}'
```

### Update a chart

```bash
formo charts update <chartId> --boardId <boardId> --body '<json>'
```

> Requires `boards:write` scope.

### Delete a chart

```bash
formo charts delete <chartId> --boardId <boardId>
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
| `--events` | Events configuration as a JSON string |

> Requires `contracts:write` scope.

**Examples:**
```bash
formo contracts create \
  --address 0x1234567890abcdef1234567890abcdef12345678 \
  --chain 1 \
  --name "My Token" \
  --abi '[{"type":"event","name":"Transfer","inputs":[]}]' \
  --events '{"Transfer":true}'
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
formo segments create --title <title> --filterSets '<json>'
```

| Option | Description |
|---|---|
| `--title` | Segment title |
| `--filterSets` | JSON array of filter set strings defining the segment |

> Requires `segments:write` scope.

**Examples:**
```bash
formo segments create --title "Whales" --filterSets '["net_worth_usd > 100000"]'
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
formo import wallets --addresses '<json>' --writeKey <writeKey>
```

| Option | Description |
|---|---|
| `--addresses` | JSON array of wallet address strings to import |
| `--writeKey` | Project write SDK key |

> Requires `profiles:write` scope. **Only available on Scale and Enterprise plans.**

**Examples:**
```bash
formo import wallets \
  --addresses '["0xabc123…","0xdef456…"]' \
  --writeKey write_key_xxx
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
