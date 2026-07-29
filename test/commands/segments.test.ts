import { expect } from 'chai';
import { listSegmentsRun, createSegmentRun } from '../../src/commands/segments';
import { requiresLiveApi } from '../helpers/liveApi';

// Response shape: PaginatedResponse<Segment> { data, total, page, size, has_more } (no envelope).

describe('commands/segments', function () {
  describe('listSegmentsRun()', function () {
    it('returns a paginated list of segments', async function () {
      await requiresLiveApi(this);
      const res = await listSegmentsRun() as { data: unknown[]; total: number; has_more: boolean };
      expect(res.data).to.be.an('array');
      expect(res).to.have.property('total');
      expect(res).to.have.property('has_more');
    });
  });

  describe('createSegmentRun() — local validation', function () {
    it('throws on invalid --filters JSON', function () {
      expect(() => createSegmentRun({ title: 'x', filters: 'not-json' })).to.throw(/filters/);
    });

    it('throws when --filters is valid JSON but not an array', function () {
      expect(() => createSegmentRun({ title: 'x', filters: '{"a":1}' })).to.throw(/filters/);
      expect(() => createSegmentRun({ title: 'x', filters: '5' })).to.throw(/filters/);
      expect(() => createSegmentRun({ title: 'x', filters: '"foo"' })).to.throw(/filters/);
    });
  });
});
