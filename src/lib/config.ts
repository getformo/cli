import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'formo');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface FormoConfig {
  apiKey?: string;
  workspace?: string;
  projectId?: string;
}

export function readConfig(): FormoConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as FormoConfig;
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
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(CONFIG_DIR, 0o700);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
  fs.chmodSync(CONFIG_FILE, 0o600);
}

export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2), {
        mode: 0o600,
      });
      // Same create-only-mode caveat as saveConfig: enforce 0o600 on the
      // already-existing file so the cleared config can't be left readable.
      fs.chmodSync(CONFIG_FILE, 0o600);
    }
  } catch {
    // Ignore errors if file doesn't exist
  }
}

export function getApiKey(): string | undefined {
  return process.env.FORMO_API_KEY ?? readConfig().apiKey;
}

