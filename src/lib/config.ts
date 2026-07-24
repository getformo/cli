import fs from 'fs';
import os from 'os';
import path from 'path';

// FORMO_CONFIG_DIR lets tests (and users) redirect config away from the real
// ~/.config/formo — resolved lazily so a test can set it after import.
function configDir(): string {
  return (
    process.env.FORMO_CONFIG_DIR ?? path.join(os.homedir(), '.config', 'formo')
  );
}

export function getConfigFile(): string {
  return path.join(configDir(), 'config.json');
}

export interface FormoConfig {
  apiKey?: string;
  workspace?: string;
  projectId?: string;
}

export function readConfig(): FormoConfig {
  try {
    const raw = fs.readFileSync(getConfigFile(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    // JSON.parse happily returns null/"abc"/[1] — treat anything that isn't a
    // plain object as an empty config instead of crashing later callers.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as FormoConfig;
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<FormoConfig>): void {
  const existing = readConfig();
  const merged = { ...existing, ...updates };
  // The `mode` option on mkdir/writeFile is honored ONLY when the path is
  // newly created. A pre-existing dir/file (older CLI version, dotfile-sync
  // tool, another app under ~/.config) keeps its old, possibly
  // group/world-readable perms — leaking the plaintext API key on a
  // multi-user host. chmod unconditionally so 0o700/0o600 always holds.
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  fs.chmodSync(configDir(), 0o700);
  fs.writeFileSync(getConfigFile(), JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
  fs.chmodSync(getConfigFile(), 0o600);
}

export function clearConfig(): void {
  try {
    fs.writeFileSync(getConfigFile(), JSON.stringify({}, null, 2), {
      mode: 0o600,
    });
    // Same create-only-mode caveat as saveConfig: enforce 0o600 on the
    // already-existing file so the cleared config can't be left readable.
    fs.chmodSync(getConfigFile(), 0o600);
  } catch (err) {
    // Nothing to clear is fine; a real write failure (EACCES, EROFS) must
    // surface so `formo logout` can't claim success while the key remains.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export function getApiKey(): string | undefined {
  return process.env.FORMO_API_KEY ?? readConfig().apiKey;
}
