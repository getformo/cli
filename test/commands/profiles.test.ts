import { expect } from 'chai';
import {
  batchCreateProfileLabelsRun,
  batchUpdateProfilesRun,
  buildUpdateProfileBody,
  createProfileLabelRun,
  deleteProfileLabelRun,
  getProfileRun,
  searchProfilesRun,
  updateProfileRun,
} from '../../src/commands/profiles';
import { requiresLiveApi } from '../helpers/liveApi';

// Vitalik's address — publicly known, should always return a profile
const KNOWN_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('commands/profiles', function () {
  describe('getProfileRun()', function () {
    it('returns a profile object for a known address', async function () {
      await requiresLiveApi(this);
      const result = await getProfileRun(KNOWN_ADDRESS) as Record<string, unknown>;
      expect(result).to.be.an('object');
    });

    it('encodes address and accepts an expand param', async function () {
      await requiresLiveApi(this);
      const result = await getProfileRun(KNOWN_ADDRESS, 'chains') as Record<string, unknown>;
      expect(result).to.be.an('object');
    });
  });

  describe('searchProfilesRun()', function () {
    it('returns a paginated list of profiles', async function () {
      await requiresLiveApi(this);
      const result = await searchProfilesRun({ size: 3 }) as unknown;
      // PaginatedResponse<Profile>: { data, total, page, size, has_more }
      expect(result).to.exist;
    });

    it('accepts orderBy and orderDir params', async function () {
      await requiresLiveApi(this);
      const result = await searchProfilesRun({
        size: 2,
        orderBy: 'net_worth_usd',
        orderDir: 'desc',
      }) as unknown;
      expect(result).to.exist;
    });

    it('throws on invalid filters JSON', function () {
      expect(() =>
        searchProfilesRun({ filters: 'not-json' }),
      ).to.throw(/filters/);
    });

    it('throws when filters is not a JSON array', function () {
      expect(() =>
        searchProfilesRun({ filters: '{"field":"x"}' }),
      ).to.throw(/filters/);
    });

    it('requires an address for historical snapshot searches', function () {
      expect(() =>
        searchProfilesRun({ timestamp: '2025-06-21T10:03:00Z' }),
      ).to.throw(/timestamp.*address/);
    });
  });

  describe('updateProfileRun() — local validation', function () {
    it('throws on invalid properties JSON', function () {
      expect(() =>
        updateProfileRun(KNOWN_ADDRESS, { properties: 'not-json' }),
      ).to.throw(/properties/);
    });

    it('throws when properties is not an object', function () {
      expect(() =>
        updateProfileRun(KNOWN_ADDRESS, { properties: '[1,2,3]' }),
      ).to.throw(/properties/);
    });

    it('throws when properties is empty', function () {
      expect(() =>
        updateProfileRun(KNOWN_ADDRESS, { properties: '{}' }),
      ).to.throw(/at least one key/);
    });

    it('throws when neither --properties nor --unset is provided', function () {
      expect(() => updateProfileRun(KNOWN_ADDRESS, {})).to.throw(
        /properties.*unset/,
      );
    });

    it('throws when --unset is only commas/whitespace', function () {
      expect(() =>
        updateProfileRun(KNOWN_ADDRESS, { unset: ' , ,' }),
      ).to.throw(/--unset/);
    });

    it('throws when --unset includes user_id', function () {
      expect(() =>
        updateProfileRun(KNOWN_ADDRESS, { unset: 'email,user_id' }),
      ).to.throw(/user_id cannot be unset/);
    });

    it('maps --unset keys to null values in the request body', function () {
      expect(
        buildUpdateProfileBody({ unset: 'email, twitter' }),
      ).to.deep.equal({ email: null, twitter: null });
    });

    it('merges --properties values with --unset nulls (unset wins on overlap)', function () {
      expect(
        buildUpdateProfileBody({
          properties: '{"display_name":"alice.eth","email":"a@x.co"}',
          unset: 'email',
        }),
      ).to.deep.equal({ display_name: 'alice.eth', email: null });
    });

    it('passes explicit null values in --properties through unchanged', function () {
      expect(
        buildUpdateProfileBody({ properties: '{"email":null}' }),
      ).to.deep.equal({ email: null });
    });
  });

  describe('createProfileLabelRun() — local validation', function () {
    it('throws when neither --tag-id nor --labels is provided', function () {
      expect(() => createProfileLabelRun(KNOWN_ADDRESS, {})).to.throw(/tag-id|labels/);
    });

    it('throws on invalid labels JSON', function () {
      expect(() =>
        createProfileLabelRun(KNOWN_ADDRESS, { labels: 'not-json' }),
      ).to.throw(/labels/);
    });

    it('throws when labels is not a non-empty array', function () {
      expect(() =>
        createProfileLabelRun(KNOWN_ADDRESS, { labels: '[]' }),
      ).to.throw(/labels/);
    });
  });

  describe('batchUpdateProfilesRun() — local validation', function () {
    it('throws on invalid rows JSON', function () {
      expect(() => batchUpdateProfilesRun({ rows: 'not-json' })).to.throw(/rows/);
    });

    it('throws when a row is missing address', function () {
      expect(() =>
        batchUpdateProfilesRun({ rows: '[{"display_name":"Alice"}]' }),
      ).to.throw(/address/);
    });
  });

  describe('batchCreateProfileLabelsRun() — local validation', function () {
    it('throws on invalid labels JSON', function () {
      expect(() => batchCreateProfileLabelsRun({ labels: 'not-json' })).to.throw(/labels/);
    });

    it('throws when a row is missing tag_id', function () {
      expect(() =>
        batchCreateProfileLabelsRun({ labels: '[{"address":"0xabc"}]' }),
      ).to.throw(/tag_id/);
    });
  });

  describe('deleteProfileLabelRun() — local validation', function () {
    it('throws when --tag-id is missing', function () {
      expect(() =>
        deleteProfileLabelRun(KNOWN_ADDRESS, { tagId: '' }),
      ).to.throw(/tag-id/);
    });
  });
});
