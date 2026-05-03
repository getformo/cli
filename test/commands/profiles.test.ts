import { expect } from 'chai';
import { getProfileRun, searchProfilesRun } from '../../src/commands/profiles';

// Vitalik's address — publicly known, should always return a profile
const KNOWN_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('commands/profiles', function () {
  describe('getProfileRun()', function () {
    it('returns a profile object for a known address', async function () {
      const result = await getProfileRun(KNOWN_ADDRESS) as Record<string, unknown>;
      expect(result).to.be.an('object');
    });

    it('encodes address and accepts an expand param', async function () {
      const result = await getProfileRun(KNOWN_ADDRESS, 'chains') as Record<string, unknown>;
      expect(result).to.be.an('object');
    });
  });

  describe('searchProfilesRun()', function () {
    it('returns a paginated list of profiles', async function () {
      const result = await searchProfilesRun({ size: 3 }) as unknown;
      // PaginatedResponse<Profile>: { data, total, page, size, has_more }
      expect(result).to.exist;
    });

    it('accepts orderBy and orderDir params', async function () {
      const result = await searchProfilesRun({
        size: 2,
        orderBy: 'net_worth_usd',
        orderDir: 'desc',
      }) as unknown;
      expect(result).to.exist;
    });

    it('throws on invalid conditions JSON', function () {
      expect(() =>
        searchProfilesRun({ conditions: 'not-json' }),
      ).to.throw(/conditions/);
    });

    it('throws when conditions is not a JSON array', function () {
      expect(() =>
        searchProfilesRun({ conditions: '{"field":"x"}' }),
      ).to.throw(/conditions/);
    });
  });
});
