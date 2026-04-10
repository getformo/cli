import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'chai';

// We test config functions by overriding the env var so getApiKey() reads from env,
// and by directly exercising readConfig/saveConfig using the real config path.
// For isolation we save/restore the real config file around each test.

describe('lib/config', function () {
  let originalApiKey: string | undefined;
  let backupConfig: string | null = null;
  const configFile = path.join(os.homedir(), '.config', 'formo', 'config.json');

  before(function () {
    originalApiKey = process.env.FORMO_API_KEY;
    // Back up any existing config
    try {
      backupConfig = fs.readFileSync(configFile, 'utf-8');
    } catch {
      backupConfig = null;
    }
  });

  after(function () {
    // Restore original config
    if (backupConfig !== null) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, backupConfig, { mode: 0o600 });
    } else {
      try { fs.unlinkSync(configFile); } catch { /* ignore */ }
    }
    if (originalApiKey !== undefined) {
      process.env.FORMO_API_KEY = originalApiKey;
    } else {
      delete process.env.FORMO_API_KEY;
    }
  });

  describe('readConfig()', function () {
    it('returns empty object when config file does not exist', async function () {
      const { readConfig } = await import('../../src/lib/config');
      try { fs.unlinkSync(configFile); } catch { /* ignore */ }
      const cfg = readConfig();
      expect(cfg).to.deep.equal({});
    });

    it('returns parsed config when file exists', async function () {
      const { readConfig, saveConfig } = await import('../../src/lib/config');
      saveConfig({ apiKey: 'test_key_123' });
      const cfg = readConfig();
      expect(cfg).to.have.property('apiKey', 'test_key_123');
    });
  });

  describe('saveConfig()', function () {
    it('merges with existing config', async function () {
      const { readConfig, saveConfig } = await import('../../src/lib/config');
      saveConfig({ apiKey: 'key_a' });
      saveConfig({ workspace: 'my-workspace' });
      const cfg = readConfig();
      expect(cfg).to.have.property('apiKey', 'key_a');
      expect(cfg).to.have.property('workspace', 'my-workspace');
    });

    it('writes file with mode 0o600', async function () {
      const { saveConfig } = await import('../../src/lib/config');
      saveConfig({ apiKey: 'key_mode_test' });
      const stat = fs.statSync(configFile);
      // mode & 0o777 extracts permission bits
      expect(stat.mode & 0o777).to.equal(0o600);
    });
  });

  describe('clearConfig()', function () {
    it('resets config to empty object', async function () {
      const { readConfig, saveConfig, clearConfig } = await import('../../src/lib/config');
      saveConfig({ apiKey: 'to_be_cleared' });
      clearConfig();
      const cfg = readConfig();
      expect(cfg).to.deep.equal({});
    });
  });

  describe('getApiKey()', function () {
    it('prefers FORMO_API_KEY env var over config file', async function () {
      const { saveConfig, getApiKey } = await import('../../src/lib/config');
      saveConfig({ apiKey: 'file_key' });
      process.env.FORMO_API_KEY = 'env_key';
      expect(getApiKey()).to.equal('env_key');
    });

    it('falls back to config file when env var is not set', async function () {
      const { saveConfig, getApiKey } = await import('../../src/lib/config');
      delete process.env.FORMO_API_KEY;
      saveConfig({ apiKey: 'file_key_fallback' });
      expect(getApiKey()).to.equal('file_key_fallback');
      // Restore for other tests
      process.env.FORMO_API_KEY = process.env.TEST_TOKEN;
    });
  });
});
