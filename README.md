# @formo/cli

Command-line interface for the Formo API. Manage wallet profiles, alerts, dashboards, charts, contracts, segments, and run analytics SQL — directly from your terminal or via AI agents.

## Installation

```bash
npm install -g @formo/cli
# or use without installing:
npx @formo/cli
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
| `--orderBy` | `last_onchain`, `first_onchain`, `net_worth_usd`, `updated_at`, `tx_count`, `first_seen`, `last_seen`, `num_sessions`, `revenue`, `volume`, `points` |
| `--orderDir` | `asc` or `desc` |
| `--expand` | Comma-separated fields to expand |
| `--conditions` | JSON array of `FilterCondition` objects (see below) |
| `--logic` | Combine conditions with `and` (default) or `or` |

```bash
formo profiles search --size 10
formo profiles search --orderBy net_worth_usd --orderDir desc --size 5
formo profiles search --page 2 --size 20
formo profiles search --conditions '[{"field":"net_worth_usd","op":"gt","value":10000}]' --size 20
formo profiles search --conditions '[{"field":"net_worth_usd","op":"gt","value":10000},{"field":"tx_count","op":"gt","value":50}]' --logic or --size 20
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

### `profiles labels create <address>`

Upsert one or more labels on a wallet profile. Provide either a single label via `--tagId` or a batch via `--labels`.

| Option | Description |
|---|---|
| `--tagId` | Label identifier (e.g. `vip`, `airdrop_eligible`) |
| `--value` | Optional label value (e.g. tier name, country code) |
| `--chainId` | Optional chain identifier the label applies to |
| `--labels` | JSON array of `UserLabelInput` objects for batch upsert |

```bash
formo profiles labels create 0xd8dA... --tagId vip
formo profiles labels create 0xd8dA... --tagId tier --value gold --chainId 1
formo profiles labels create 0xd8dA... --labels '[{"tag_id":"vip"},{"tag_id":"airdrop_eligible","chain_id":"1"}]'
```

### `profiles labels delete <address>`

Delete a label from a wallet profile.

| Option | Description |
|---|---|
| `--tagId` | Label identifier to delete (required) |
| `--chainId` | Optional chain identifier to scope the deletion |

```bash
formo profiles labels delete 0xd8dA... --tagId vip
formo profiles labels delete 0xd8dA... --tagId tier --chainId 1
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
| `--triggerType` | Trigger type (e.g. `event`, `threshold`) |
| `--triggerFilters` | JSON array of trigger filter objects |
| `--recipient` | JSON array of recipient objects |
| `--secret` | Webhook secret |

```bash
formo alerts create --name "High value tx" --triggerType event \
  --triggerFilters '[{"name":"event","operator":"equals","value":"transaction"}]' \
  --recipient '[{"type":"email","value":["alerts@myapp.com"]}]'
```

### `alerts update <alertId>`
Same options as `create`. Replaces the alert configuration.

### `alerts delete <alertId>`
Delete an alert.

### `alerts toggle <alertId> --status <active|paused>`
Toggle an alert between `active` and `paused`.

```bash
formo alerts toggle alert_abc123 --status paused
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
| `--name` | Board name |
| `--description` | Optional board description |

```bash
formo boards create --name "Revenue Metrics" --description "Weekly revenue tracking"
```

### `boards update <boardId>`

| Option | Description |
|---|---|
| `--name` | New board name |
| `--description` | New board description |

### `boards delete <boardId>`
Delete a board.

---

## `formo charts`

Chart commands. Charts live inside a board. Requires `charts:read` / `charts:write`.

### `charts list --boardId <boardId>`
List all charts in a board.

### `charts get <chartId> --boardId <boardId>`
Get a single chart by ID.

### `charts create --boardId <boardId> --body '<json>'`
Create a chart from a JSON config string.

### `charts update <chartId> --boardId <boardId> --body '<json>'`
Update a chart.

### `charts delete <chartId> --boardId <boardId>`
Delete a chart.

---

## `formo contracts`

Smart contract commands. Requires `contracts:read` / `contracts:write`.

### `contracts list`
List all tracked contracts. Returns `{ data: Contract[], deploy: { last_deployed_at, diff }, total, page, size, has_more }`.

### `contracts create`

| Option | Description |
|---|---|
| `--address` | Contract address (`0x…`) |
| `--chain` | Chain ID (e.g. `1`, `137`) |
| `--name` | Human-readable contract name |
| `--abi` | Contract ABI as a JSON string |
| `--events` | Events configuration as a JSON string |

```bash
formo contracts create --address 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984 --chain 1 \
  --name "UNI Token" --abi '[{"type":"event","name":"Transfer","inputs":[]}]' \
  --events '{"Transfer":true}'
```

### `contracts update <chain> <address>`

| Option | Description |
|---|---|
| `--name` | Updated contract name |
| `--abi` | Updated ABI |
| `--events` | Updated events config |

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
| `--filterSets` | JSON array of filter set strings defining the segment |

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

## `formo import`

### `import wallets`

Bulk-import wallet addresses into the project via the events API.

| Option | Description |
|---|---|
| `--addresses` | JSON array of wallet address strings |
| `--writeKey` | Project write SDK key |

```bash
formo import wallets --addresses '["0xabc...","0xdef..."]' --writeKey write_key_xyz
```

---

## FilterCondition reference

`profiles search --conditions` accepts a JSON array of filter condition objects:

```json
[
  { "field": "net_worth_usd", "op": "gt", "value": 10000 },
  { "field": "tx_count", "op": "gte", "value": 5 }
]
```

| Field | Type | Description |
|---|---|---|
| `field` | `string` | Profile field to filter on |
| `op` | `string` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin` |
| `value` | `any` | Value to compare against |

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
