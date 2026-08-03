/**
 * Probes the live API once with the configured key, then decides whether the
 * integration tests in this run can proceed.
 *
 * The distinction that matters:
 *
 * - **No TEST_TOKEN at all** — skip. Fork PRs cannot read repo secrets, and
 *   failing them would make every outside contribution red.
 * - **TEST_TOKEN present but rejected** — FAIL. A skip here is indistinguishable
 *   from a healthy run, and that is exactly how an expired credential hid for a
 *   week while CI reported green over the whole canonical-filter migration.
 * - **Host unreachable** — skip. Network flakiness is not a code defect.
 *
 * Tests that hit the network call `requiresLiveApi(this)` in a `before`
 * (or directly in the test) to opt in.
 */
import type { Context } from 'mocha';
import { getApiBaseUrl } from '../../src/lib/client';

// Honor FORMO_API_BASE_URL so the probe hits the same host the client uses.
const API_BASE_URL = getApiBaseUrl();

type ProbeStatus = 'unknown' | 'ok' | 'absent' | 'rejected' | 'unreachable';

let probeStatus: ProbeStatus = 'unknown';
let probePromise: Promise<void> | undefined;

// preload.cjs substitutes a dummy key when TEST_TOKEN is unset, so the token's
// own presence — not FORMO_API_KEY — tells us whether a credential was supplied.
const tokenWasSupplied = () => Boolean(process.env.TEST_TOKEN);

async function probe(): Promise<void> {
  const apiKey = process.env.FORMO_API_KEY;
  if (!apiKey) {
    probeStatus = 'absent';
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/validate-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (res.status === 401 || res.status === 403) {
      probeStatus = tokenWasSupplied() ? 'rejected' : 'absent';
      if (probeStatus === 'rejected') {
        process.stderr.write(
          `\n  ✖ TEST_TOKEN was rejected by ${API_BASE_URL} (HTTP ${res.status}).\n` +
          `    Refresh the FORMO test API key and update the TEST_TOKEN secret.\n\n`,
        );
      }
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
  if (probeStatus === 'ok') return;
  // A supplied-but-rejected credential is a broken setup, not an absent one —
  // surface it as a failure so the suite can never be green while silently
  // covering nothing.
  if (probeStatus === 'rejected') {
    throw new Error(
      `TEST_TOKEN was rejected by ${API_BASE_URL}. The live-API tests cannot run. ` +
        'Mint a read-scoped Formo API key and update both .env and the TEST_TOKEN repo secret.',
    );
  }
  ctx.skip();
}
