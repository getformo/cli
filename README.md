# @formo/cli

Command-line interface for the Formo API. Query wallet profiles and run analytics SQL queries directly from your terminal or via AI agents.

## Installation

```bash
npm install -g @formo/cli
# or use without installing:
npx @formo/cli
```

## Authentication

Authenticate by saving your API key:

```bash
formo login <apiKey>
```

Or set the `FORMO_API_KEY` environment variable — it takes precedence over the saved config:

```bash
export FORMO_API_KEY=formo_abc123
```

## Commands

### `formo login`

Save your API key to `~/.config/formo/config.json`.

| Argument | Description |
|---|---|
| `apiKey` | Your `formo_` API key |

```bash
formo login formo_abc123
```

---

### `formo profiles get`

Fetch a single wallet profile by address or ENS name.

| Argument | Description |
|---|---|
| `address` | Wallet address (`0x…`) or ENS name |

| Option | Description |
|---|---|
| `--expand` | Comma-separated fields to expand: `apps`, `chains`, `tokens`, `labels` |

```bash
formo profiles get 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
formo profiles get vitalik.eth --expand labels,chains
```

---

### `formo profiles search`

Search wallet profiles with optional filters and sorting.

| Option | Description |
|---|---|
| `--address` | Filter by wallet address |
| `--limit` | Max results to return |
| `--offset` | Pagination offset |
| `--orderBy` | Field to sort by (see values below) |
| `--orderDir` | Sort direction: `asc` or `desc` |
| `--expand` | Comma-separated fields to expand |
| `--conditions` | JSON array of `FilterCondition` objects (see below) |

**`--orderBy` values:** `last_onchain`, `first_onchain`, `net_worth_usd`, `updated_at`, `tx_count`, `first_seen`, `last_seen`, `num_sessions`, `revenue`, `volume`, `points`

```bash
# First 10 profiles
formo profiles search --limit 10

# Top 5 by net worth
formo profiles search --orderBy net_worth_usd --orderDir desc --limit 5

# Advanced filter with conditions
formo profiles search --conditions '[{"field":"net_worth_usd","op":"gt","value":10000}]' --limit 20
```

---

### `formo query run`

Run a SQL query against your Formo analytics data.

```bash
formo query run "SELECT count(*) FROM events"
formo query run "SELECT address, net_worth_usd FROM wallet_profiles ORDER BY net_worth_usd DESC LIMIT 10"
```

> Requires `query:read` scope on your API key.

---

## FilterCondition reference

The `--conditions` option accepts a JSON array of filter condition objects:

```json
[
  { "field": "net_worth_usd", "op": "gt", "value": 10000 },
  { "field": "tx_count", "op": "gte", "value": 5 }
]
```

| Field | Type | Description |
|---|---|---|
| `field` | `string` | Profile field to filter on |
| `op` | `string` | Operator: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin` |
| `value` | `any` | Value to compare against |

Multiple conditions are combined with `AND` logic.

---

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm --filter @formo/cli dev

# Build TypeScript
pnpm --filter @formo/cli build

# Run tests
pnpm --filter @formo/cli test

# Watch tests
pnpm --filter @formo/cli test:watch
```
