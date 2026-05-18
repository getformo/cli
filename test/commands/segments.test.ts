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
    it('throws on invalid --filter-sets JSON', function () {
      expect(() => createSegmentRun({ title: 'x', filterSets: 'not-json' })).to.throw(/filter-sets/);
    });
  });
});
