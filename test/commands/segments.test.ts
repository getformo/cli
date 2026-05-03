import { expect } from 'chai';
import { listSegmentsRun, createSegmentRun } from '../../src/commands/segments';

// Response shape: Segment[] (bare resource — no envelope).

describe('commands/segments', function () {
  describe('listSegmentsRun()', function () {
    it('returns an array of segments', async function () {
      const res = await listSegmentsRun() as unknown[];
      expect(res).to.be.an('array');
    });
  });

  describe('createSegmentRun() — local validation', function () {
    it('throws on invalid filterSets JSON', function () {
      expect(() => createSegmentRun({ title: 'x', filterSets: 'not-json' })).to.throw(/filterSets/);
    });
  });
});
