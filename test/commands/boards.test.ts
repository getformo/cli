import { expect } from 'chai';
import { listBoardsRun, getBoardRun } from '../../src/commands/boards';

// Response shape: Board[] for list, Board for get (bare resource — no envelope).

describe('commands/boards', function () {
  let firstBoardId: string | undefined;

  describe('listBoardsRun()', function () {
    it('returns an array of boards', async function () {
      const res = await listBoardsRun() as { id: string }[];
      expect(res).to.be.an('array');
      if (res.length > 0) firstBoardId = res[0].id;
    });
  });

  describe('getBoardRun()', function () {
    it('returns a board by ID', async function () {
      if (!firstBoardId) return this.skip();
      const res = await getBoardRun(firstBoardId) as { id: string };
      expect(res).to.have.property('id', firstBoardId);
    });
  });
});
