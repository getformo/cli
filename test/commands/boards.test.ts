import { expect } from 'chai';
import { listBoardsRun, getBoardRun } from '../../src/commands/boards';

// Response shape: PaginatedResponse<Board> { data, total, page, size, has_more } for list,
//                 Board for get (bare resource — no envelope).

describe('commands/boards', function () {
  let firstBoardId: string | undefined;

  describe('listBoardsRun()', function () {
    it('returns a paginated list of boards', async function () {
      const res = await listBoardsRun() as { data: { id: string }[]; total: number; has_more: boolean };
      expect(res.data).to.be.an('array');
      expect(res).to.have.property('total');
      expect(res).to.have.property('has_more');
      if (res.data.length > 0) firstBoardId = res.data[0].id;
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
