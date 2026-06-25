import { expect } from 'chai';
import { importWalletsRun } from '../../src/commands/import';

describe('commands/import', function () {
  describe('importWalletsRun() — local validation', function () {
    it('throws on invalid addresses JSON', function () {
      expect(() =>
        importWalletsRun({
          addresses: 'not-json',
        }),
      ).to.throw(/addresses/);
    });

    it('throws when addresses is not a JSON array', function () {
      expect(() =>
        importWalletsRun({
          addresses: '"just-a-string"',
        }),
      ).to.throw(/addresses/);
    });

    it('throws when addresses is a JSON object, not array', function () {
      expect(() =>
        importWalletsRun({
          addresses: '{"address":"0xabc"}',
        }),
      ).to.throw(/addresses/);
    });

    it('throws when rows entries do not include an address', function () {
      expect(() =>
        importWalletsRun({
          rows: '[{"properties":{"display_name":"Alice"}}]',
        }),
      ).to.throw(/address/);
    });
  });

  describe('importWalletsRun() — API call', function () {
    it('imports wallets when explicitly enabled', async function () {
      if (process.env.TEST_IMPORT_WALLETS !== '1') {
        this.skip(); // Set TEST_IMPORT_WALLETS=1 to run this plan-gated mutation
      }
      const result = await importWalletsRun({
        addresses: JSON.stringify(['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045']),
      }) as unknown;
      expect(result).to.exist;
    });
  });
});
