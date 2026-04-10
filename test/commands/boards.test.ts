import { expect } from 'chai';
import { listBoardsRun, getBoardRun } from '../../src/commands/boards';

// Response shape: { isSuccess: true, data: Board[] } for list
//                 { isSuccess: true, data: Board }   for get

describe('commands/boards', function () {
  let firstBoardId: string | undefined;

  describe('listBoardsRun()', function () {
    it('returns an array of boards', async function () {
      const res = await listBoardsRun() as { isSuccess: boolean; data: { id: string }[] };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.be.an('array');
      if (res.data.length > 0) firstBoardId = res.data[0].id;
    });
  });

  describe('getBoardRun()', function () {
    it('returns a board by ID', async function () {
      if (!firstBoardId) return this.skip();
      const res = await getBoardRun(firstBoardId) as { isSuccess: boolean; data: { id: string } };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.have.property('id', firstBoardId);
    });
  });
});
