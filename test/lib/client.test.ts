import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'chai';
import {
  createClient,
  getApiBaseUrl,
  getEventsBaseUrl,
  requireApiKey,
} from '../../src/lib/client';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

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
      const saved = process.env.FORMO_API_BASE_URL;
      delete process.env.FORMO_API_BASE_URL;
      const client = createClient();
      expect(client.defaults.baseURL).to.equal('https://api.formo.so');
      restoreEnv('FORMO_API_BASE_URL', saved);
    });

    it('uses FORMO_API_BASE_URL when set', function () {
      const saved = process.env.FORMO_API_BASE_URL;
      process.env.FORMO_API_BASE_URL = 'http://localhost:3001';
      expect(getApiBaseUrl()).to.equal('http://localhost:3001');
      expect(createClient().defaults.baseURL).to.equal('http://localhost:3001');
      restoreEnv('FORMO_API_BASE_URL', saved);
    });

    it('uses FORMO_EVENTS_BASE_URL when set', function () {
      const saved = process.env.FORMO_EVENTS_BASE_URL;
      process.env.FORMO_EVENTS_BASE_URL = 'http://localhost:3002';
      expect(getEventsBaseUrl()).to.equal('http://localhost:3002');
      restoreEnv('FORMO_EVENTS_BASE_URL', saved);
    });

    it('sets a 30 second timeout', function () {
      const client = createClient();
      expect(client.defaults.timeout).to.equal(30_000);
    });
  });
});
