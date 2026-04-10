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
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
}

export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2), {
        mode: 0o600,
      });
    }
  } catch {
    // Ignore errors if file doesn't exist
  }
}

export function getApiKey(): string | undefined {
  return process.env.FORMO_API_KEY ?? readConfig().apiKey;
}

