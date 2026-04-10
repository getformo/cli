import { expect } from 'chai';
import { importWalletsRun } from '../../src/commands/import';

describe('commands/import', function () {
  describe('importWalletsRun() — local validation', function () {
    it('throws on invalid addresses JSON', function () {
      expect(() =>
        importWalletsRun({
          addresses: 'not-json',
          writeKey: 'write_key_test',
        }),
      ).to.throw(/addresses/);
    });

    it('throws when addresses is not a JSON array', function () {
      expect(() =>
        importWalletsRun({
          addresses: '"just-a-string"',
          writeKey: 'write_key_test',
        }),
      ).to.throw(/addresses/);
    });

    it('throws when addresses is a JSON object, not array', function () {
      expect(() =>
        importWalletsRun({
          addresses: '{"address":"0xabc"}',
          writeKey: 'write_key_test',
        }),
      ).to.throw(/addresses/);
    });
  });

  describe('importWalletsRun() — API call', function () {
    it('imports wallets when WRITE_KEY is provided', async function () {
      const writeKey = process.env.TEST_WRITE_KEY;
      if (!writeKey) {
        this.skip(); // Set TEST_WRITE_KEY in .env to run this test
      }
      const result = await importWalletsRun({
        addresses: JSON.stringify(['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045']),
        writeKey,
      }) as unknown;
      expect(result).to.exist;
    });
  });
});
