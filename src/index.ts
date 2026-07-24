#!/usr/bin/env node
import { Cli, z } from "incur";

import { alerts } from "./commands/alerts";
import { analytics } from "./commands/analytics";
import { boards } from "./commands/boards";
import { charts } from "./commands/charts";
import { contracts } from "./commands/contracts";
import { events } from "./commands/events";
import { importCmd } from "./commands/import";
import { profiles } from "./commands/profiles";
import { query } from "./commands/query";
import { segments } from "./commands/segments";
import { getApiBaseUrl } from "./lib/client";
import {
  clearConfig,
  getApiKey,
  getConfigFile,
  readConfig,
  saveConfig,
} from "./lib/config";
import { banner, color, error, info, maskKey, success, warn } from "./lib/ui";

// Single source of truth for --version; a hardcoded literal here drifted
// from package.json more than once. package.json sits outside rootDir, so
// use require() rather than an import (tsc would widen the output layout).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: VERSION } = require("../package.json") as { version: string };

const DASHBOARD_URL = "https://app.formo.so";
const DOCS_URL = "https://docs.formo.so";

function loginGuide(): string {
  return [
    "",
    color.boldGreen("How to get your API key:"),
    "",
    `  ${color.white("1.")} Go to ${color.cyan(DASHBOARD_URL)}`,
    `  ${color.white("2.")} Navigate to ${color.bold("Settings")} → ${color.bold("API")}`,
    `  ${color.white("3.")} Click ${color.bold('"Create API Key"')} and copy the key`,
    `  ${color.white("4.")} Run:`,
    "",
    `     ${color.green("formo login <formo_your_api_key_here>")}`,
    "",
    color.dim(`  Or set the environment variable:`),
    "",
    `     ${color.green("export FORMO_API_KEY=formo_your_api_key_here")}`,
    "",
    color.dim(`  Docs: ${DOCS_URL}`),
    "",
  ].join("\n");
}

interface ValidateApiKeyData {
  validated: boolean;
  details: string;
  teamId: string;
  scopes: { project_id?: string } | null;
}

type KeyValidationResult =
  | { kind: "valid"; workspace: string; projectId: string }
  | { kind: "invalid" }
  | { kind: "unreachable" };

async function validateAndFetchWorkspace(
  apiKey: string,
): Promise<KeyValidationResult> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/validate-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
      // fetch has no default timeout — without this, login can hang forever.
      signal: AbortSignal.timeout(10_000),
    });

    // The server answered and rejected the key — distinct from "couldn't
    // reach the server", so login can refuse to save a known-bad key.
    if (!res.ok) return { kind: "invalid" };

    const body = (await res.json()) as ValidateApiKeyData;
    if (!body.validated) return { kind: "invalid" };

    return {
      kind: "valid",
      workspace: body.details,
      projectId: body.scopes?.project_id ?? "",
    };
  } catch {
    return { kind: "unreachable" };
  }
}

const cli = Cli.create("formo", {
  version: VERSION,
  description: "Formo API CLI — Web3 analytics from the terminal",
  sync: {
    suggestions: [
      "get the profile for wallet 0xabc",
      "search profiles with net worth > 10000",
      "run a SQL query on my analytics data",
      "show traffic KPIs for the last 7 days",
      "get the conversion funnel for the last month",
      "list the top wallets by activity",
      "search profiles ordered by last_onchain desc",
      "list all project alerts",
      "create an alert for high-value transactions",
      "list charts in a board",
      "create a line chart in a board",
      "move or duplicate a dashboard chart",
      "list all tracked contracts",
      "register a new smart contract",
      "list user segments",
      "import wallet addresses",
      "batch update profile properties with profiles properties batch",
      "batch upsert labels for wallets",
      "send raw analytics events",
    ],
  },
});

// ── login ──

cli.command("login", {
  description: "Authenticate with your Formo API key",
  args: z.object({
    apiKey: z.string().optional().describe("Your formo_ API key"),
  }),
  options: z.object({}),
  examples: [{ args: { apiKey: "formo_abc123" }, description: "Save API key" }],
  async run({ args }) {
    // No key provided → show guide
    if (!args.apiKey) {
      if (process.stdout.isTTY) {
        process.stderr.write(loginGuide());
      }
      return { ok: false, message: "No API key provided. See guide above." };
    }

    const isTTY = process.stdout.isTTY;

    // Validate the key against the API
    if (isTTY) {
      process.stderr.write("\n" + color.dim("Validating API key…") + "\n");
    }

    const result = await validateAndFetchWorkspace(args.apiKey);

    // The server explicitly rejected the key — refuse to save it. Saving a
    // known-bad key just defers the failure to the user's next command.
    if (result.kind === "invalid") {
      throw new Error(
        "API key was rejected by the Formo API (invalid or revoked). " +
          "Check the key and try again, or create a new one at " +
          `${DASHBOARD_URL} under Settings → API.`,
      );
    }

    // Save the key. Offline (unreachable) logins still save — the user may
    // simply have no network right now. Only include workspace/projectId
    // when validated so offline logins don't wipe existing values, and only
    // a non-empty projectId so an unscoped key doesn't clear a stored one.
    const workspaceInfo = result.kind === "valid" ? result : undefined;
    saveConfig({
      apiKey: args.apiKey,
      ...(workspaceInfo && { workspace: workspaceInfo.workspace }),
      ...(workspaceInfo?.projectId && { projectId: workspaceInfo.projectId }),
    });

    // Show feedback in human mode
    if (isTTY) {
      const masked = maskKey(args.apiKey);

      if (workspaceInfo) {
        process.stderr.write(
          success("API key validated and saved!") +
            "\n" +
            info(`Key: ${color.dim(masked)}`) +
            "\n" +
            info(`Workspace: ${color.bold(workspaceInfo.workspace)}`) +
            "\n" +
            (workspaceInfo.projectId
              ? info(`Project: ${color.dim(workspaceInfo.projectId)}`) + "\n"
              : "") +
            info(`Config: ${color.dim(getConfigFile())}`) +
            "\n\n" +
            color.dim("You can now use all formo commands.") +
            "\n" +
            color.dim("Run ") +
            color.green("formo --help") +
            color.dim(" to see available commands.") +
            "\n\n",
        );
      } else {
        process.stderr.write(
          warn("API key saved but could not be validated.") +
            "\n" +
            info(`Key: ${color.dim(masked)}`) +
            "\n" +
            info(`Config: ${color.dim(getConfigFile())}`) +
            "\n" +
            color.dim(
              "The API was unreachable. Your key is saved and will be used for requests.",
            ) +
            "\n\n",
        );
      }
    }

    return {
      ok: true,
      message: workspaceInfo
        ? "API key validated and saved"
        : "API key saved (API unreachable, not validated)",
      workspace: workspaceInfo?.workspace ?? null,
      projectId: workspaceInfo?.projectId ?? null,
    };
  },
});

// ── logout ──

cli.command("logout", {
  description: "Remove saved API key and clear authentication",
  run() {
    const hadKey = !!readConfig().apiKey;
    clearConfig();

    if (process.stdout.isTTY) {
      process.stderr.write("\n");
      if (hadKey) {
        process.stderr.write(
          success("Logged out successfully.") +
            "\n" +
            info(`API key removed from ${getConfigFile()}`) +
            "\n",
        );
      } else {
        process.stderr.write(
          info("No saved API key found — already logged out.") + "\n",
        );
      }

      if (process.env.FORMO_API_KEY) {
        process.stderr.write(
          "\n" +
            warn(`${color.yellow("FORMO_API_KEY")} env var is still set.`) +
            "\n" +
            info(
              `Run ${color.green("unset FORMO_API_KEY")} to fully log out.`,
            ) +
            "\n",
        );
      }

      process.stderr.write("\n");
    }

    return {
      ok: true,
      message: hadKey ? "API key removed" : "Already logged out",
      envVarSet: !!process.env.FORMO_API_KEY,
    };
  },
});

// ── status ──

cli.command("status", {
  description: "Show current authentication and CLI status",
  run() {
    const apiKey = getApiKey();
    const config = readConfig();
    const source = process.env.FORMO_API_KEY
      ? "FORMO_API_KEY env var"
      : "config file";

    if (process.stdout.isTTY) {
      process.stderr.write("\n");
      if (apiKey) {
        const masked = maskKey(apiKey);
        process.stderr.write(
          success("Authenticated") +
            "\n" +
            info(`Key: ${color.dim(masked)}`) +
            "\n" +
            info(`Source: ${color.dim(source)}`) +
            "\n" +
            (config.workspace
              ? info(`Workspace: ${color.bold(config.workspace)}`) + "\n"
              : "") +
            (config.projectId
              ? info(`Project ID: ${color.dim(config.projectId)}`) + "\n"
              : "") +
            "\n",
        );
      } else {
        process.stderr.write(
          error("Not authenticated") +
            "\n\n" +
            info(`Run ${color.green("formo login")} to get started.`) +
            "\n\n",
        );
      }
    }

    return {
      authenticated: !!apiKey,
      source: apiKey ? source : null,
      workspace: config.workspace ?? null,
      projectId: config.projectId ?? null,
      configFile: config.apiKey ? getConfigFile() : null,
    };
  },
});

// ── command groups ──

cli.command(profiles);
cli.command(query);
cli.command(analytics);
cli.command(alerts);
cli.command(boards);
cli.command(charts);
cli.command(contracts);
cli.command(events);
cli.command(segments);
cli.command(importCmd);

// Show banner when run with no args (root help)
const args = process.argv.slice(2);
const isRootHelp =
  args.length === 0 ||
  (args.length === 1 && (args[0] === "--help" || args[0] === "-h"));
if (isRootHelp && process.stdout.isTTY) {
  process.stderr.write(banner());
}

cli.serve();

export default cli;
