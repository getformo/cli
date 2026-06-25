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
import { clearConfig, getApiKey, readConfig, saveConfig } from "./lib/config";
import { banner, color, error, info, success, warn } from "./lib/ui";

const DASHBOARD_URL = "https://app.formo.so";
const DOCS_URL = "https://docs.formo.so";

function loginGuide(): string {
  return [
    "",
    color.boldGreen("How to get your API key:"),
    "",
    `  ${color.white("1.")} Go to ${color.cyan(DASHBOARD_URL)}`,
    `  ${color.white("2.")} Navigate to ${color.bold("Settings")} → ${color.bold("API Keys")}`,
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

async function validateAndFetchWorkspace(
  apiKey: string,
): Promise<{ workspace: string; projectId: string } | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/validate-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (!res.ok) return null;

    const body = (await res.json()) as ValidateApiKeyData;
    if (!body.validated) return null;

    return {
      workspace: body.details,
      projectId: body.scopes?.project_id ?? "",
    };
  } catch {
    return null;
  }
}

const cli = Cli.create("formo", {
  version: "1.0.1",
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

    const workspaceInfo = await validateAndFetchWorkspace(args.apiKey);

    // Save key + workspace info (save even if validation fails — user might be offline)
    // Only include workspace/projectId when present so offline logins don't wipe existing values
    saveConfig({
      apiKey: args.apiKey,
      ...(workspaceInfo?.workspace !== undefined && {
        workspace: workspaceInfo.workspace,
      }),
      ...(workspaceInfo?.projectId !== undefined && {
        projectId: workspaceInfo.projectId,
      }),
    });

    // Show feedback in human mode
    if (isTTY) {
      const masked =
        args.apiKey.length > 12
          ? args.apiKey.slice(0, 8) + "…" + args.apiKey.slice(-4)
          : "***";

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
            info(`Config: ${color.dim("~/.config/formo/config.json")}`) +
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
            info(`Config: ${color.dim("~/.config/formo/config.json")}`) +
            "\n" +
            color.dim(
              "The API might be unreachable. Your key is saved and will be used for requests.",
            ) +
            "\n\n",
        );
      }
    }

    return {
      ok: true,
      message: workspaceInfo
        ? "API key validated and saved"
        : "API key saved (not validated)",
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
            info("API key removed from ~/.config/formo/config.json") +
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
        const masked =
          apiKey.length > 12
            ? apiKey.slice(0, 8) + "…" + apiKey.slice(-4)
            : "***";
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
      configFile: config.apiKey ? "~/.config/formo/config.json" : null,
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
  args.length === 0 || (args.length === 1 && args[0] === "--help");
if (isRootHelp && process.stdout.isTTY) {
  process.stderr.write(banner());
}

cli.serve();

export default cli;
