/**
 * Probes the live API once with the configured key. If it returns 401,
 * integration tests in this run are skipped with a clear message rather
 * than each test individually failing on auth.
 *
 * Tests that hit the network call `requiresLiveApi(this)` in a `before`
 * (or directly in the test) to opt into the skip.
 */
import type { Context } from 'mocha';
import { getApiBaseUrl } from '../../src/lib/client';

// Honor FORMO_API_BASE_URL so the probe hits the same host the client uses.
const API_BASE_URL = getApiBaseUrl();

let probeStatus: 'unknown' | 'ok' | 'unauthorized' | 'unreachable' = 'unknown';
let probePromise: Promise<void> | undefined;

async function probe(): Promise<void> {
  const apiKey = process.env.FORMO_API_KEY;
  if (!apiKey) {
    probeStatus = 'unauthorized';
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/validate-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (res.status === 401 || res.status === 403) {
      probeStatus = 'unauthorized';
      process.stderr.write(
        `\n  ⚠ Integration tests skipped: TEST_TOKEN was rejected by ${API_BASE_URL} (HTTP ${res.status}).\n` +
        `    Refresh the FORMO test API key and update the TEST_TOKEN secret.\n\n`,
      );
      return;
    }
    if (!res.ok) {
      probeStatus = 'unreachable';
      process.stderr.write(
        `\n  ⚠ Integration tests skipped: probe to ${API_BASE_URL} returned HTTP ${res.status}.\n\n`,
      );
      return;
    }
    probeStatus = 'ok';
  } catch (err) {
    probeStatus = 'unreachable';
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `\n  ⚠ Integration tests skipped: ${API_BASE_URL} is unreachable (${msg}).\n\n`,
    );
  }
}

export async function requiresLiveApi(ctx: Context): Promise<void> {
  if (probeStatus === 'unknown') {
    if (!probePromise) probePromise = probe();
    await probePromise;
  }
  if (probeStatus !== 'ok') ctx.skip();
}
