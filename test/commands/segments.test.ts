import { expect } from 'chai';
import { listSegmentsRun, createSegmentRun } from '../../src/commands/segments';

// Response shape: { isSuccess: true, data: Segment[] }

describe('commands/segments', function () {
  describe('listSegmentsRun()', function () {
    it('returns an array of segments', async function () {
      const res = await listSegmentsRun() as { isSuccess: boolean; data: unknown[] };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.be.an('array');
    });
  });

  describe('createSegmentRun() — local validation', function () {
    it('throws on invalid filterSets JSON', function () {
      expect(() => createSegmentRun({ title: 'x', filterSets: 'not-json' })).to.throw(/filterSets/);
    });
  });
});
