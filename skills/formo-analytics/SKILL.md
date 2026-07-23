---
name: formo-analytics
description: Query and manage Formo product analytics and onchain wallet data through the Formo MCP server, @formo/cli, or public REST API. Use when an agent needs to inspect KPIs, events, funnels, retention, revenue, users, wallet profiles, contracts, segments, boards, charts, or alerts; run SQL against a Formo project; ingest analytics events; search Formo documentation; or configure Formo access for an AI client.
---

# Formo Analytics

Use Formo's project-scoped analytics and wallet intelligence from an AI agent. Select the narrowest interface that already exists in the environment, discover live schemas before writing SQL, and preserve Formo's authentication and tenant boundaries.

## Select an interface

1. Use the Formo MCP when its tools are available. It is the best path for conversational analytics, live tool discovery, Formo documentation search, and project-scoped SQL.
2. Use `formo` when the CLI is installed or a repeatable terminal command is useful. It covers analytics plus profiles, alerts, boards, charts, contracts, segments, imports, and event ingestion.
3. Use the public REST API for programmatic integrations that need explicit HTTP requests or an operation unavailable through the current MCP/CLI surface.
4. Do not ask the user to configure a second interface when an authenticated one already satisfies the request.

Canonical endpoints and packages:

- MCP: `https://api.formo.so/v0/mcp/`
- REST API: `https://api.formo.so/v0/`
- OpenAPI: `https://api.formo.so/openapi.json`
- Event ingestion: `https://events.formo.so/`
- CLI: `npx @formo/cli`
- Documentation: `https://docs.formo.so`

## Authenticate safely

- Use MCP OAuth when the host supports custom-connector OAuth.
- Otherwise use a project-scoped workspace API key as `Authorization: Bearer <key>` for MCP, CLI, and REST.
- Run `formo login <apiKey>` to save a CLI credential, or use the CLI's documented environment-based authentication for ephemeral sessions.
- Use a project SDK write key, not a workspace API key, for raw event ingestion.
- Request only the scopes required by the task. Analytics and SQL need `query:read`; charts use `boards:read` or `boards:write`; other resources use the matching `*:read` or `*:write` scope.
- Never print, commit, log, or repeat credentials. Mask keys in status output and examples.
- Treat the project bound to the credential as authoritative. Do not inject or guess another `project_id`.

If authentication is missing, explain the minimum credential and scope needed, then stop before making authenticated calls.

## Query analytics

Follow this sequence:

1. Clarify the metric, time range, timezone, filters, and desired grain from available context.
2. Prefer a published analytics endpoint for standard KPIs, funnels, retention, lifecycle, traffic, revenue, and top-N questions.
3. Discover available endpoints and schemas before using MCP SQL tools. Call `list_endpoints` and `list_datasources` when the live surface is unknown.
4. Use `execute_query` or `formo query run` only when a published endpoint cannot answer the question.
5. Apply explicit date bounds and a reasonable `LIMIT` to exploratory SQL.
6. Report the filters and time range with the answer. Distinguish zero rows from an execution error.

Useful MCP tools include:

- `list_endpoints`, `list_datasources`
- `text_to_sql`, `execute_query`, `explore_data`
- published tools such as `kpis`, `lifecycle`, `top_events`, `top_pages`, `top_sources`, `top_locations`, `revenue_overview`, `wallet_profiles`, and `project_retention`
- `search_formo_docs` and `query_docs_filesystem_formo_docs` for grounded product and API questions

The live endpoint list varies by project. Prefer discovery over assuming a tool exists.

CLI examples:

```bash
formo analytics kpis --date-from 2026-07-01 --date-to 2026-07-31
formo analytics funnel --date-from 2026-07-01 --date-to 2026-07-31 \
  --params '{"steps":[{"type":"event","event":"page","name":"visit","filters":[]},{"type":"track","event":"connect","name":"connect","filters":[]}],"window_seconds":86400}'
formo query run "SELECT event, count(*) AS events FROM events WHERE timestamp >= now() - INTERVAL 7 DAY GROUP BY event ORDER BY events DESC LIMIT 20"
```

Available CLI analytics pipes include `kpis`, `event_timeseries`, `funnel`, `flow`, `frequency`, `lifecycle`, `retention`, `revenue_overview`, `revenue_by_metric`, `revenue_timeseries`, `volume_by_metric`, `top_chains`, `top_events`, `top_locations`, `top_pages`, `top_sources`, and `top_wallets`.

## Work with wallet profiles

Use a direct lookup for one address or ENS name. Use search for cohorts, ordering, or pagination.

```bash
formo profiles get vitalik.eth --expand labels,chains,tokens
formo profiles search --order-by net_worth_usd --order-dir desc --size 10
formo profiles search \
  --conditions '[{"field":"users.net_worth_usd","op":"gt","value":10000}]' \
  --size 20
```

Always use typed filter paths such as `users.net_worth_usd`, `chains.1.balance`, `apps.uniswap-v3.balance`, `tokens.<address>.balance`, or `labels.<source>.<tag>`. A bare field such as `net_worth_usd` may be ignored.

Profile updates, label changes, and wallet imports require `profiles:write`. Preserve pagination metadata and continue only while `has_more` is true.

## Manage Formo resources

Use CLI command groups for operational resources:

- `formo alerts` for alert list/get/create/update/delete/toggle/test
- `formo boards` and `formo charts` for dashboards and visualizations
- `formo contracts` for tracked contract configuration and pipeline inclusion
- `formo segments` for saved audiences
- `formo import wallets` for bulk wallet import
- `formo events ingest` for raw events

Inspect help before constructing unfamiliar payloads:

```bash
formo <group> --help
formo <group> <command> --help
```

Read operations may proceed when the user asks for inspection or analysis. For create, update, delete, toggle, import, and ingest operations, verify the intended target and payload and do not broaden the user's requested scope. Ask before proceeding only when the target is ambiguous, the operation is destructive, or the user has not authorized the external change. Prefer idempotent operations where the API supports them.

## Call the REST API

Fetch the current OpenAPI document before implementing an integration or when exact request fields matter:

```bash
curl -sS https://api.formo.so/openapi.json
```

Send workspace API requests under `/v0/*`:

```bash
curl -sS "https://api.formo.so/v0/profiles/vitalik.eth?expand=labels,chains" \
  -H "Authorization: Bearer <workspace-api-key>"
```

Successful single-resource responses are bare resources. List endpoints normally return `{data,page,size,total,has_more}`. Errors use `{error:{code,message,doc_url,param?,details?}}`; branch on `error.code`, not the human-readable message.

Use page-based pagination, respect rate limits, and retry only safe or explicitly idempotent requests. Do not use Formo's internal `/api/*` dashboard routes for external integrations.

## Produce reliable results

- Ground Formo product, SDK, pricing, and API claims with `search_formo_docs` or `https://docs.formo.so`.
- Use JSON output for automation: `formo ... --json`.
- Preserve full response envelopes when pagination or metadata matters: `formo ... --verbose`.
- Validate SQL against discovered schemas. Never invent columns, endpoints, or filter fields.
- State assumptions and call out partial data, sampling, timezone ambiguity, or unavailable expansions.
- Include the source interface used (MCP tool, CLI command, or REST endpoint) when handing off reproducible work.
- Note that Formo requires an account and that feature or API availability can depend on the workspace plan.
