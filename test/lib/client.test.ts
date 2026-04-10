import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'chai';
import { createClient, requireApiKey } from '../../src/lib/client';

describe('lib/client', function () {
  describe('requireApiKey()', function () {
    it('does not throw when FORMO_API_KEY is set', function () {
      // TEST_TOKEN is set via setup.ts → FORMO_API_KEY
      expect(() => requireApiKey()).to.not.throw();
    });

    it('throws when no API key is configured', function () {
      const savedEnv = process.env.FORMO_API_KEY;
      delete process.env.FORMO_API_KEY;
      const configFile = path.join(os.homedir(), '.config', 'formo', 'config.json');
      let configBackup: string | null = null;
      try {
        configBackup = fs.readFileSync(configFile, 'utf-8');
        fs.writeFileSync(configFile, '{}', { mode: 0o600 });
      } catch { /* file may not exist */ }
      try {
        expect(() => requireApiKey()).to.throw(/No API key configured/);
      } finally {
        if (configBackup !== null) fs.writeFileSync(configFile, configBackup, { mode: 0o600 });
        process.env.FORMO_API_KEY = savedEnv;
      }
    });
  });

  describe('createClient()', function () {
    it('creates an axios instance with Authorization header when key is set', function () {
      const client = createClient();
      // The instance's defaults contain the auth header set during creation
      const headers = (client.defaults.headers as Record<string, unknown>);
      const auth = headers['Authorization'] ?? headers['authorization'];
      expect(auth).to.be.a('string');
      expect(auth as string).to.match(/^Bearer /);
    });

    it('uses https://api.formo.so as base URL', function () {
      const client = createClient();
      expect(client.defaults.baseURL).to.equal('https://api.formo.so');
    });

    it('sets a 30 second timeout', function () {
      const client = createClient();
      expect(client.defaults.timeout).to.equal(30_000);
    });
  });
});
